import type { GrayImage } from "./decode";

/**
 * Centerline tracing: turns a black-on-white line drawing into one pen stroke per drawn
 * line (rather than an outline around both edges of every line, as outline tracers do).
 *
 *   threshold (Otsu) → remove specks and pinholes → thin to a 1 px skeleton (Zhang–Suen)
 *   → skeleton graph (ends, junctions, edges, loops) → prune spurs → join edges that
 *   carry on straight through a junction → smooth → simplify (Douglas–Peucker)
 *   → smooth Bézier curves (Catmull–Rom) → stroke-only SVG in image pixels.
 *
 * The result stays within the AI sanitizer's budget: when it would be too large it's
 * simplified harder and the shortest strokes are dropped first.
 */

export interface TraceOptions {
    /** Luminance cut-off between ink and paper (0–255). Otsu's method when omitted. */
    threshold?: number;
    /** Path-data budget, in characters, for the whole SVG. */
    maxPathChars?: number;
    /** Most strokes (one <path> each). */
    maxStrokes?: number;
}

export interface TraceResult {
    /** Stroke-only SVG, viewBox in image pixels. */
    svg: string;
    strokes: number;
    pathChars: number;
    /** Average width of the drawn lines, in pixels. */
    lineWidth: number;
    width: number;
    height: number;
}

/** Nothing usable could be traced (blank image, or no lines at all). */
export class TraceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TraceError";
    }
}

type Point = [number, number];

interface Stroke {
    points: Point[];
    closed: boolean;
}

const DEFAULT_MAX_PATH_CHARS = 48_000;
const DEFAULT_MAX_STROKES = 450;
/** How far the ink cut-off moves from Otsu's towards the paper tone (0–1). */
const INK_BIAS = 0.4;

// ---------------------------------------------------------------------------
// Ink mask

function boxBlur(image: GrayImage): Float32Array {
    const { width, height, data } = image;
    const horizontal = new Float32Array(width * height);
    const out = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const left = data[row + Math.max(0, x - 1)];
            const right = data[row + Math.min(width - 1, x + 1)];
            horizontal[row + x] = (left + data[row + x] + right) / 3;
        }
    }
    for (let y = 0; y < height; y++) {
        const up = Math.max(0, y - 1) * width;
        const down = Math.min(height - 1, y + 1) * width;
        const row = y * width;
        for (let x = 0; x < width; x++) out[row + x] = (horizontal[up + x] + horizontal[row + x] + horizontal[down + x]) / 3;
    }
    return out;
}

/** Otsu's method: the cut-off that best separates the two tones. */
export function otsuThreshold(values: ArrayLike<number>): number {
    const histogram = new Float64Array(256);
    for (let i = 0; i < values.length; i++) histogram[Math.max(0, Math.min(255, Math.round(values[i])))]++;

    const total = values.length;
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * histogram[t];

    let sumBelow = 0;
    let weightBelow = 0;
    let best = 127;
    let bestVariance = -1;
    for (let t = 0; t < 256; t++) {
        weightBelow += histogram[t];
        if (weightBelow === 0) continue;
        const weightAbove = total - weightBelow;
        if (weightAbove === 0) break;
        sumBelow += t * histogram[t];
        const meanBelow = sumBelow / weightBelow;
        const meanAbove = (sumAll - sumBelow) / weightAbove;
        const variance = weightBelow * weightAbove * (meanBelow - meanAbove) ** 2;
        if (variance > bestVariance) {
            bestVariance = variance;
            best = t;
        }
    }
    return best;
}

/** Labels connected regions of `value` (8-connected for ink, 4-connected for paper). */
function regions(mask: Uint8Array, W: number, H: number, value: 0 | 1, onRegion: (pixels: number[], touchesBorder: boolean) => void) {
    const seen = new Uint8Array(W * H);
    const offsets = value === 1 ? [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1] : [-W, -1, 1, W];
    const stack: number[] = [];

    for (let start = 0; start < mask.length; start++) {
        if (mask[start] !== value || seen[start]) continue;
        const pixels: number[] = [];
        let touchesBorder = false;
        seen[start] = 1;
        stack.push(start);
        while (stack.length) {
            const p = stack.pop()!;
            pixels.push(p);
            const x = p % W;
            const y = (p - x) / W;
            if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                touchesBorder = true;
                // The padding frame: don't step outside it.
                if (value === 0) {
                    for (const offset of offsets) {
                        const q = p + offset;
                        const qx = q % W;
                        if (q < 0 || q >= mask.length || Math.abs(qx - x) > 1) continue;
                        if (mask[q] === value && !seen[q]) {
                            seen[q] = 1;
                            stack.push(q);
                        }
                    }
                }
                continue;
            }
            for (const offset of offsets) {
                const q = p + offset;
                if (mask[q] === value && !seen[q]) {
                    seen[q] = 1;
                    stack.push(q);
                }
            }
        }
        onRegion(pixels, touchesBorder);
    }
}

/**
 * The ink as a 0/1 mask with a one-pixel empty frame (so neighbour lookups never leave
 * the array). Ink is whichever tone covers less of the image, so white-on-black works too.
 */
function inkMask(image: GrayImage, threshold: number | undefined) {
    const { width, height } = image;
    const blurred = boxBlur(image);
    const otsu = threshold ?? otsuThreshold(blurred);
    const W = width + 2;
    const H = height + 2;
    const mask = new Uint8Array(W * H);

    let dark = 0;
    for (let i = 0; i < blurred.length; i++) if (blurred[i] < otsu) dark++;
    const inkIsDark = dark <= blurred.length / 2;
    // Fine lines (whiskers, hair) come out grey once anti-aliased, so Otsu's cut misses
    // them. Without an explicit threshold, move the cut part of the way towards paper.
    const cut = threshold ?? (inkIsDark ? otsu + (255 - otsu) * INK_BIAS : otsu * (1 - INK_BIAS));

    let ink = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const value = blurred[y * width + x];
            if (inkIsDark ? value < cut : value >= cut) {
                mask[(y + 1) * W + x + 1] = 1;
                ink++;
            }
        }
    }
    return { mask, W, H, ink };
}

/** Removes ink specks and fills pinholes inside lines (both would trace as tiny loops). */
function cleanMask(mask: Uint8Array, W: number, H: number, pixelCount: number) {
    const minSpeck = Math.max(8, Math.round(pixelCount * 0.00003));
    const maxHole = Math.max(6, Math.round(pixelCount * 0.00002));

    regions(mask, W, H, 1, (pixels) => {
        if (pixels.length < minSpeck) for (const p of pixels) mask[p] = 0;
    });
    regions(mask, W, H, 0, (pixels, touchesBorder) => {
        if (!touchesBorder && pixels.length <= maxHole) for (const p of pixels) mask[p] = 1;
    });

    let ink = 0;
    for (let i = 0; i < mask.length; i++) ink += mask[i];
    return ink;
}

// ---------------------------------------------------------------------------
// Skeleton

/** Neighbours in Zhang–Suen order: N, NE, E, SE, S, SW, W, NW. */
const ring = (W: number) => [-W, -W + 1, 1, W + 1, W, W - 1, -1, -W - 1];

/** Zhang–Suen thinning, in place: every line becomes one pixel wide. */
function thin(mask: Uint8Array, W: number) {
    const [N, NE, E, SE, S, SW, Wd, NW] = ring(W);
    let pixels: number[] = [];
    for (let i = 0; i < mask.length; i++) if (mask[i]) pixels.push(i);

    const remove: number[] = [];
    let changed = true;
    while (changed) {
        changed = false;
        for (let step = 0; step < 2; step++) {
            remove.length = 0;
            for (const p of pixels) {
                if (!mask[p]) continue;
                const p2 = mask[p + N], p3 = mask[p + NE], p4 = mask[p + E], p5 = mask[p + SE];
                const p6 = mask[p + S], p7 = mask[p + SW], p8 = mask[p + Wd], p9 = mask[p + NW];
                const neighbours = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                if (neighbours < 2 || neighbours > 6) continue;
                const transitions =
                    (p2 < p3 ? 1 : 0) + (p3 < p4 ? 1 : 0) + (p4 < p5 ? 1 : 0) + (p5 < p6 ? 1 : 0) +
                    (p6 < p7 ? 1 : 0) + (p7 < p8 ? 1 : 0) + (p8 < p9 ? 1 : 0) + (p9 < p2 ? 1 : 0);
                if (transitions !== 1) continue;
                if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
                remove.push(p);
            }
            for (const p of remove) mask[p] = 0;
            if (remove.length) changed = true;
        }
        pixels = pixels.filter((p) => mask[p]);
    }

    // Zhang–Suen leaves staircase corners two pixels thick; those read as false
    // junctions. Drop a corner pixel when its neighbours stay connected without it.
    for (const p of pixels) {
        const n = mask[p + N], e = mask[p + E], s = mask[p + S], w = mask[p + Wd];
        if (!((n && e) || (e && s) || (s && w) || (w && n))) continue;
        const values = ring(W).map((offset) => mask[p + offset]);
        const count = values.reduce((sum, value) => sum + value, 0);
        if (count < 2) continue;
        let transitions = 0;
        for (let i = 0; i < 8; i++) if (values[i] < values[(i + 1) % 8]) transitions++;
        if (transitions === 1) mask[p] = 0;
    }
}

// ---------------------------------------------------------------------------
// Skeleton graph

interface Edge {
    a: number;
    b: number;
    points: Point[];
    alive: boolean;
    /** A loop with no ends (a ring, or two ends joined at one junction). */
    closed: boolean;
}

const length = (points: Point[]) => {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    return total;
};

function buildGraph(mask: Uint8Array, W: number) {
    const offsets = ring(W);
    const toPoint = (p: number): Point => [(p % W) - 0.5, Math.floor(p / W) - 0.5];
    const degree = (p: number) => {
        let count = 0;
        for (const offset of offsets) count += mask[p + offset];
        return count;
    };

    // Nodes: line ends (1 neighbour) and junction clusters (3+ neighbours, merged when touching).
    const nodeOf = new Int32Array(mask.length).fill(-1);
    const centres: Point[] = [];
    /** Blobs that thinned down to a single pixel (dots, like eyes). */
    const dots: Point[] = [];
    let skeleton = 0;
    for (let p = 0; p < mask.length; p++) {
        if (!mask[p]) continue;
        skeleton++;
        const d = degree(p);
        if (d === 0) {
            mask[p] = 0;
            dots.push(toPoint(p));
            continue;
        }
        if (d === 2 || nodeOf[p] >= 0) continue;

        const id = centres.length;
        const cluster = [p];
        nodeOf[p] = id;
        if (d >= 3) {
            for (let i = 0; i < cluster.length; i++) {
                for (const offset of offsets) {
                    const q = cluster[i] + offset;
                    if (mask[q] && nodeOf[q] < 0 && degree(q) >= 3) {
                        nodeOf[q] = id;
                        cluster.push(q);
                    }
                }
            }
        }
        let sx = 0;
        let sy = 0;
        for (const q of cluster) {
            const [x, y] = toPoint(q);
            sx += x;
            sy += y;
        }
        centres.push([sx / cluster.length, sy / cluster.length]);
    }

    const edges: Edge[] = [];
    const visited = new Uint8Array(mask.length);
    const directLinks = new Set<string>();

    for (let q = 0; q < mask.length; q++) {
        const from = nodeOf[q];
        if (!mask[q] || from < 0) continue;
        for (const offset of offsets) {
            const r = q + offset;
            if (!mask[r] || nodeOf[r] === from) continue;
            if (nodeOf[r] >= 0) {
                const key = from < nodeOf[r] ? `${from}:${nodeOf[r]}` : `${nodeOf[r]}:${from}`;
                if (directLinks.has(key)) continue;
                directLinks.add(key);
                edges.push({ a: from, b: nodeOf[r], points: [centres[from], centres[nodeOf[r]]], alive: true, closed: false });
                continue;
            }
            if (visited[r]) continue;

            const points: Point[] = [centres[from], toPoint(r)];
            visited[r] = 1;
            let previous = q;
            let current = r;
            let to = -1;
            let backToOrigin = false;
            for (;;) {
                let next = -1;
                for (const step of offsets) {
                    const s = current + step;
                    if (!mask[s] || s === previous) continue;
                    if (nodeOf[s] >= 0) {
                        // Reaching a node (but not stepping straight back into the one we left).
                        if (nodeOf[s] !== from || points.length > 2) {
                            next = s;
                            break;
                        }
                        backToOrigin = true;
                        continue;
                    }
                    if (!visited[s]) next = s;
                }
                if (next < 0 && backToOrigin) {
                    // A one-pixel bump on the node: a tiny loop, dropped later as too short.
                    to = from;
                    break;
                }
                if (next < 0) break;
                if (nodeOf[next] >= 0) {
                    to = nodeOf[next];
                    break;
                }
                visited[next] = 1;
                points.push(toPoint(next));
                previous = current;
                current = next;
            }
            if (to < 0) {
                // Dead end in a damaged skeleton: keep it as an open edge to a new end node.
                to = centres.length;
                centres.push(points[points.length - 1]);
            } else {
                points.push(centres[to]);
            }
            edges.push({ a: from, b: to, points, alive: true, closed: false });
        }
    }

    // Rings with no ends or junctions.
    for (let p = 0; p < mask.length; p++) {
        if (!mask[p] || nodeOf[p] >= 0 || visited[p]) continue;
        const points: Point[] = [toPoint(p)];
        visited[p] = 1;
        let previous = -1;
        let current = p;
        for (;;) {
            let next = -1;
            for (const offset of offsets) {
                const s = current + offset;
                if (mask[s] && s !== previous && !visited[s]) {
                    next = s;
                    break;
                }
            }
            if (next < 0) break;
            visited[next] = 1;
            points.push(toPoint(next));
            previous = current;
            current = next;
        }
        if (points.length >= 3) {
            points.push(points[0]);
            edges.push({ a: -1, b: -1, points, alive: true, closed: true });
        }
    }

    return { edges, nodeCount: centres.length, skeleton, dots };
}

/** Number of live edge ends at each node. */
function degrees(edges: Edge[], nodeCount: number) {
    const count = new Int32Array(nodeCount);
    for (const edge of edges) {
        if (!edge.alive || edge.closed) continue;
        count[edge.a]++;
        count[edge.b]++;
    }
    return count;
}

/** Joins `first` (oriented to end at `node`) and `second` (oriented to start there). */
function joinAt(first: Edge, second: Edge, node: number): Edge {
    const head = first.b === node ? first.points : [...first.points].reverse();
    const tail = second.a === node ? second.points : [...second.points].reverse();
    const start = first.b === node ? first.a : first.b;
    const end = second.a === node ? second.b : second.a;
    return { a: start, b: end, points: [...head, ...tail.slice(1)], alive: true, closed: false };
}

/** Direction leaving `node` along `edge`, measured a few pixels out to skip pixel noise. */
function direction(edge: Edge, node: number, reach: number): Point | null {
    const points = edge.a === node ? edge.points : [...edge.points].reverse();
    const origin = points[0];
    let travelled = 0;
    let end = points[points.length - 1];
    for (let i = 1; i < points.length; i++) {
        travelled += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        if (travelled >= reach) {
            end = points[i];
            break;
        }
    }
    const dx = end[0] - origin[0];
    const dy = end[1] - origin[1];
    const norm = Math.hypot(dx, dy);
    return norm > 0 ? [dx / norm, dy / norm] : null;
}

function simplifyGraph(edges: Edge[], nodeCount: number, lineWidth: number) {
    const spur = Math.max(3, lineWidth * 1.2);

    // 1. Prune short spurs (an end hanging off a junction), a few rounds.
    for (let round = 0; round < 3; round++) {
        const count = degrees(edges, nodeCount);
        let pruned = false;
        for (const edge of edges) {
            if (!edge.alive || edge.closed || edge.a === edge.b) continue;
            const spurEnd = (count[edge.a] === 1 && count[edge.b] >= 3) || (count[edge.b] === 1 && count[edge.a] >= 3);
            if (spurEnd && length(edge.points) < spur) {
                edge.alive = false;
                pruned = true;
            }
        }
        if (!pruned) break;
    }

    const live = () => edges.filter((edge) => edge.alive);
    const incident = (node: number) => live().filter((edge) => !edge.closed && (edge.a === node || edge.b === node));

    // 2. Merge through nodes with exactly two edges (left behind by pruning), and pair
    //    edges that carry on straight through a junction, so lines aren't cut there.
    const reach = Math.max(4, lineWidth * 2.5);
    for (let node = 0; node < nodeCount; node++) {
        for (;;) {
            const here = incident(node);
            const ends: { edge: Edge; dir: Point }[] = [];
            for (const edge of here) {
                const dir = direction(edge, node, reach);
                if (!dir) continue;
                ends.push({ edge, dir });
                if (edge.a === edge.b) {
                    const back = direction({ ...edge, points: [...edge.points].reverse() }, node, reach);
                    if (back) ends.push({ edge, dir: back });
                }
            }
            if (ends.length < 2) break;

            // Every pairing passes through the same junction point, so joining never
            // changes the drawing; the straightest pair just makes the most natural stroke.
            let best: [number, number] | null = null;
            let bestCos = Infinity;
            for (let i = 0; i < ends.length; i++) {
                for (let j = i + 1; j < ends.length; j++) {
                    const cos = ends[i].dir[0] * ends[j].dir[0] + ends[i].dir[1] * ends[j].dir[1];
                    if (cos < bestCos) {
                        bestCos = cos;
                        best = [i, j];
                    }
                }
            }
            if (!best) break;

            const first = ends[best[0]].edge;
            const second = ends[best[1]].edge;
            if (first === second) {
                // Both ends of one edge meet here (both already at the node's centre): a closed loop.
                first.closed = true;
                continue;
            }
            first.alive = false;
            second.alive = false;
            const joined = joinAt(first, second, node);
            if (joined.a === joined.b && joined.a === node) {
                joined.closed = true;
            }
            edges.push(joined);
        }
    }

    return live().map((edge) => ({ points: edge.points, closed: edge.closed }));
}

// ---------------------------------------------------------------------------
// Geometry

/** Light smoothing that removes the pixel staircase; ends of open strokes stay put. */
function smooth(points: Point[], closed: boolean, passes = 2): Point[] {
    let current = closed ? points.slice(0, -1) : points;
    const n = current.length;
    if (n < 3) return points;
    for (let pass = 0; pass < passes; pass++) {
        const next: Point[] = new Array(n);
        for (let i = 0; i < n; i++) {
            if (!closed && (i === 0 || i === n - 1)) {
                next[i] = current[i];
                continue;
            }
            const prev = current[(i - 1 + n) % n];
            const after = current[(i + 1) % n];
            next[i] = [(prev[0] + 2 * current[i][0] + after[0]) / 4, (prev[1] + 2 * current[i][1] + after[1]) / 4];
        }
        current = next;
    }
    return closed ? [...current, current[0]] : current;
}

function distanceToSegment(p: Point, a: Point, b: Point) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker simplification (keeps both ends). */
export function simplify(points: Point[], epsilon: number): Point[] {
    if (points.length <= 2) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = 1;
    keep[points.length - 1] = 1;
    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length) {
        const [start, end] = stack.pop()!;
        let farthest = -1;
        let farthestDistance = epsilon;
        for (let i = start + 1; i < end; i++) {
            const d = distanceToSegment(points[i], points[start], points[end]);
            if (d > farthestDistance) {
                farthestDistance = d;
                farthest = i;
            }
        }
        if (farthest >= 0) {
            keep[farthest] = 1;
            stack.push([start, farthest], [farthest, end]);
        }
    }
    return points.filter((_, i) => keep[i]);
}

const fmt = (value: number) => String(Math.round(value * 10) / 10);

/** Path data through the points as smooth cubic Béziers (uniform Catmull–Rom). */
function pathData(points: Point[], closed: boolean): string {
    const pts = closed ? points.slice(0, -1) : points;
    const n = pts.length;
    if (n < 2) return "";
    if (n === 2 && !closed) return `M${fmt(pts[0][0])} ${fmt(pts[0][1])}L${fmt(pts[1][0])} ${fmt(pts[1][1])}`;

    const at = (i: number): Point => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
    const segments = closed ? n : n - 1;
    for (let i = 0; i < segments; i++) {
        const p0 = at(i - 1);
        const p1 = at(i);
        const p2 = at(i + 1);
        const p3 = at(i + 2);
        const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
    }
    return closed ? `${d}Z` : d;
}

// ---------------------------------------------------------------------------

/** Traces a line drawing into stroke-only SVG (see the module comment). */
export function traceCenterlines(image: GrayImage, options: TraceOptions = {}): TraceResult {
    const { width, height } = image;
    const maxPathChars = options.maxPathChars ?? DEFAULT_MAX_PATH_CHARS;
    const maxStrokes = options.maxStrokes ?? DEFAULT_MAX_STROKES;
    const pixelCount = width * height;

    const { mask, W, H, ink: rawInk } = inkMask(image, options.threshold);
    if (rawInk < pixelCount * 0.0003) throw new TraceError("the image has no drawing in it");
    const ink = cleanMask(mask, W, H, pixelCount);
    if (ink === 0) throw new TraceError("the image has no drawing in it");

    thin(mask, W);
    const { edges, nodeCount, skeleton, dots } = buildGraph(mask, W);
    if (skeleton === 0) throw new TraceError("no lines were found in the image");

    const lineWidth = ink / skeleton;
    const strokes: Stroke[] = simplifyGraph(edges, nodeCount, lineWidth);
    // Dots become small circles about as wide as the drawn line.
    const radius = Math.max(1, lineWidth / 2);
    for (const [x, y] of dots) {
        const points: Point[] = [];
        for (let i = 0; i <= 8; i++) points.push([x + radius * Math.cos((i * Math.PI) / 4), y + radius * Math.sin((i * Math.PI) / 4)]);
        strokes.push({ points, closed: true });
    }

    // A stroke that touches no other is a mark of its own (a window, a pupil, a dash):
    // the length filter below keeps those unless the budget is tight.
    const endKey = ([x, y]: Point) => `${Math.round(x * 2)},${Math.round(y * 2)}`;
    const endCount = new Map<string, number>();
    for (const stroke of strokes) {
        if (stroke.closed) continue;
        for (const point of [stroke.points[0], stroke.points[stroke.points.length - 1]]) {
            endCount.set(endKey(point), (endCount.get(endKey(point)) ?? 0) + 1);
        }
    }
    const isolated = (stroke: Stroke) =>
        stroke.closed || (endCount.get(endKey(stroke.points[0])) === 1 && endCount.get(endKey(stroke.points[stroke.points.length - 1])) === 1);

    const smoothed = strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.length > 9 ? smooth(stroke.points, stroke.closed) : stroke.points,
        length: length(stroke.points),
        isolated: isolated(stroke),
    }));
    // Longest first, so the budget drops the smallest details.
    smoothed.sort((a, b) => b.length - a.length);

    const epsilons = [0.7, 1.1, 1.6, 2.3, 3.2];
    let minLength = Math.max(3, lineWidth);
    for (let attempt = 0; ; attempt++) {
        const epsilon = epsilons[Math.min(attempt, epsilons.length - 1)];
        const kept: { d: string; length: number }[] = [];
        let chars = 0;
        for (const stroke of smoothed) {
            if (kept.length >= maxStrokes) continue;
            if (stroke.length < minLength && !(stroke.isolated && attempt < 2 && stroke.length >= 1)) continue;
            const simplified = simplify(stroke.points, epsilon);
            if (simplified.length < 2) continue;
            const d = pathData(simplified, stroke.closed && simplified.length > 3);
            if (!d) continue;
            kept.push({ d, length: stroke.length });
            chars += d.length;
        }

        const lastTry = attempt >= epsilons.length - 1;
        if (chars <= maxPathChars || lastTry) {
            // Still over on the last try: drop the shortest strokes until it fits.
            while (chars > maxPathChars && kept.length > 1) chars -= kept.pop()!.d.length;
            if (kept.length === 0) throw new TraceError("no lines were long enough to draw");
            const paths = kept.map(({ d }) => `<path d="${d}"/>`).join("");
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none" stroke="#000">${paths}</svg>`;
            return { svg, strokes: kept.length, pathChars: chars, lineWidth, width, height };
        }
        minLength *= 1.5;
    }
}
