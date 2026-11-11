import type { ConverterSettings } from "svg-to-gcode";

import type { ParkPosition } from "../plotter/profile";

/**
 * Pen-path optimiser for svg-to-gcode's output, working on its strokes in mm.
 *
 * svg-to-gcode orders paths greedily from its own first path and lifts the pen between
 * almost every one. This reorders the strokes it made to cut pen-up travel and lifts:
 * - open strokes may be drawn backwards, and closed ones may start at any vertex;
 * - greedy nearest-neighbour from where the pen starts, on a spatial grid, then 2-opt;
 * - gaps up to `bridgeMm` are drawn through with the pen down instead of lifting.
 *
 * Every drawn segment is kept. Only svg-to-gcode's own output is understood (a header,
 * then per stroke `G0 X Y`, pen down, `G1 X Y`…, pen up); anything else comes back
 * unchanged.
 */

export interface Point {
    x: number;
    y: number;
}

export interface OptimizeOptions {
    /** Settings the G-code was converted with: pen heights, feed and Z move time. */
    settings: ConverterSettings;
    /**
     * Where the pen is when the program starts, in the G-code's coordinates. Null when
     * unknown: the plot then starts with svg-to-gcode's first stroke.
     */
    start?: Point | null;
    /** Gaps up to this many mm are drawn with the pen down. 0 adds no ink. Default 1. */
    bridgeMm?: number;
    /** Time limit for the 2-opt pass, in ms. */
    timeBudgetMs?: number;
}

export interface OptimizeStats {
    strokes: number;
    liftsBefore: number;
    liftsAfter: number;
    /** Pen-up travel, from the start point. */
    travelBeforeMm: number;
    travelAfterMm: number;
    /** Gaps drawn with the pen down instead of lifting, and their total length. */
    bridges: number;
    bridgedMm: number;
    /** Estimated plotting time in seconds, with svg-to-gcode's model. */
    timeBefore: number;
    timeAfter: number;
    /** Time spent optimising. */
    ms: number;
}

export type OptimizeResult =
    | { optimized: true; gcode: string; time: number; stats: OptimizeStats }
    | { optimized: false; gcode: string; reason: string };

/** svg-to-gcode's defaults for the settings read here (converter.js). */
const CONVERTER_DEFAULTS = { zOffset: 3, feedRate: 1400, zValue: 10, zMoveTime: 0.5 };

const DEFAULT_BRIDGE_MM = 1;
/** A stroke whose ends are this close (mm) is a closed loop. */
const CLOSED_MM = 0.3;
/** Points this close are the same point: coordinates have 3 decimals. */
const SAME_MM = 1e-6;
/** 2-opt is O(n²) per pass, so it only runs up to this many strokes, for this long. */
const TWO_OPT_MAX_STROKES = 2000;
const TWO_OPT_MS = 150;
/** Smallest travel saving (mm) worth a move, so float noise can't loop forever. */
const MIN_GAIN = 1e-7;

/** PLOTTER_OPTIMIZE=false turns the optimiser off. */
export function plotterOptimize(): boolean {
    return !/^(false|off|no|0)$/i.test(process.env.PLOTTER_OPTIMIZE?.trim() ?? "");
}

/** PLOTTER_BRIDGE_MM: gaps up to this are drawn with the pen down. Default 1; 0 adds no ink. */
export function plotterBridgeMm(): number {
    const raw = process.env.PLOTTER_BRIDGE_MM?.trim();
    if (!raw) return DEFAULT_BRIDGE_MM;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_BRIDGE_MM;
}

/**
 * Where the pen starts a plot, in G-code coordinates before mirroring: the park position,
 * where the previous plot left it. When the output is mirrored about X = `mirrorAxis`, the
 * park position (a place on the machine) maps back with x' = 2·axis − x. Null when parking
 * is off, since the pen could then be anywhere.
 */
export function penStartPoint(park: ParkPosition | null, mirrorAxis: number | null): Point | null {
    if (!park) return null;
    return { x: mirrorAxis === null ? park.x : 2 * mirrorAxis - park.x, y: park.y };
}

// ---------------------------------------------------------------------------------------
// Parsing

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;
const XY_MOVE = new RegExp(`^G([01]) X(${NUM}) Y(${NUM})$`);
const Z_MOVE = new RegExp(`^G0 Z(${NUM})$`);
const FEED = new RegExp(`^G1 F(${NUM})$`);
const ABSOLUTE_MM = /^G90 G21$/;

interface Parsed {
    header: string[];
    /** Each pen-down run as its points, flat [x0, y0, x1, y1, …], without repeats. */
    runs: number[][];
}

const near = (a: number, b: number) => Math.abs(a - b) < SAME_MM;

/** Math.hypot is several times slower, and 2-opt calls this millions of times. */
function dist(ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
}

/** Reads svg-to-gcode's output, or says why it isn't that. */
function parse(gcode: string, zDown: number, zUp: number): Parsed | string {
    const lines = gcode.split(/\r?\n/);
    const header: string[] = [];
    let i = 0;
    let absolute = false;

    for (; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (XY_MOVE.test(line)) break;
        if (ABSOLUTE_MM.test(line)) absolute = true;
        else if (!FEED.test(line) && !Z_MOVE.test(line)) return `unexpected header line "${line}"`;
        // The header's Z move lifts the pen to a start height; lowering it there would be odd.
        const z = Z_MOVE.exec(line);
        if (z && near(Number(z[1]), zDown)) return "the header lowers the pen";
        header.push(line);
    }
    if (!absolute) return "no G90 G21 in the header";

    const runs: number[][] = [];
    let run: number[] | null = null;
    let x = NaN;
    let y = NaN;

    for (; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const move = XY_MOVE.exec(line);
        if (move) {
            const nx = Number(move[2]);
            const ny = Number(move[3]);
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return `bad coordinates in "${line}"`;
            if (move[1] === "0" && run) return "rapid move with the pen down";
            if (move[1] === "1") {
                if (!run) return "G1 move with the pen up";
                if (!near(nx, x) || !near(ny, y)) run.push(nx, ny);
            }
            x = nx;
            y = ny;
            continue;
        }

        const z = Z_MOVE.exec(line);
        if (z && near(Number(z[1]), zDown)) {
            if (!Number.isFinite(x)) return "pen down before any XY move";
            run ??= [x, y];
            continue;
        }
        if (z && near(Number(z[1]), zUp)) {
            if (run) runs.push(run);
            run = null;
            continue;
        }

        return `unexpected line "${line}"`;
    }

    if (run) return "the program ends with the pen down";
    return { header, runs };
}

// ---------------------------------------------------------------------------------------
// Strokes and tours

const OPEN = 0;
/** Closed, last point equal to the first. */
const LOOP = 1;
/** Closed with a small gap between the ends; starting it elsewhere draws the gap. */
const GAP_LOOP = 2;
type Shape = typeof OPEN | typeof LOOP | typeof GAP_LOOP;

interface Stroke {
    x: Float64Array;
    y: Float64Array;
    shape: Shape;
}

function toStroke(run: number[], gapLoopMm: number): Stroke {
    const count = run.length / 2;
    const x = new Float64Array(count);
    const y = new Float64Array(count);
    for (let i = 0; i < count; i++) {
        x[i] = run[2 * i];
        y[i] = run[2 * i + 1];
    }
    const gap = Math.hypot(x[count - 1] - x[0], y[count - 1] - y[0]);
    const shape = count < 3 ? OPEN : gap < SAME_MM ? LOOP : gap <= gapLoopMm ? GAP_LOOP : OPEN;
    return { x, y, shape };
}

/** Draws from vertex 0 to the last vertex, or backwards: not rotated. */
const unrotated = (stroke: Stroke, k: number) => stroke.shape === OPEN || (stroke.shape === GAP_LOOP && k === 0);

/** Vertex indices in drawing order, starting at vertex `k` for a loop, reversed if `rev`. */
function drawOrder(stroke: Stroke, k: number, rev: boolean): number[] {
    const count = stroke.x.length;
    const order: number[] = [];
    if (unrotated(stroke, k)) {
        for (let i = 0; i < count; i++) order.push(i);
    } else {
        // A loop's last point repeats its first. A gap loop keeps it and draws the gap.
        const end = stroke.shape === LOOP ? count - 1 : count;
        for (let i = k; i < end; i++) order.push(i);
        for (let i = 0; i <= k; i++) order.push(i);
    }
    return rev ? order.reverse() : order;
}

/**
 * The strokes in drawing order. Each is drawn from vertex `k` (loops only) and reversed
 * when `rev`; `inX/inY` and `outX/outY` are where it starts and ends.
 */
class Tour {
    readonly stroke: Int32Array;
    readonly k: Int32Array;
    readonly rev: Uint8Array;
    readonly inX: Float64Array;
    readonly inY: Float64Array;
    readonly outX: Float64Array;
    readonly outY: Float64Array;

    constructor(
        readonly strokes: Stroke[],
        readonly start: Point,
    ) {
        const n = strokes.length;
        this.stroke = new Int32Array(n);
        this.k = new Int32Array(n);
        this.rev = new Uint8Array(n);
        this.inX = new Float64Array(n);
        this.inY = new Float64Array(n);
        this.outX = new Float64Array(n);
        this.outY = new Float64Array(n);
    }

    get length() {
        return this.strokes.length;
    }

    set(i: number, s: number, k: number, rev: boolean) {
        const stroke = this.strokes[s];
        this.stroke[i] = s;
        this.k[i] = k;
        this.rev[i] = rev ? 1 : 0;
        let first = k;
        let last = k;
        if (unrotated(stroke, k)) {
            first = rev ? stroke.x.length - 1 : 0;
            last = rev ? 0 : stroke.x.length - 1;
        }
        this.inX[i] = stroke.x[first];
        this.inY[i] = stroke.y[first];
        this.outX[i] = stroke.x[last];
        this.outY[i] = stroke.y[last];
    }

    /** Pen-up travel if every gap were a lift, from the start point. */
    cost() {
        let total = 0;
        let x = this.start.x;
        let y = this.start.y;
        for (let i = 0; i < this.length; i++) {
            total += Math.hypot(this.inX[i] - x, this.inY[i] - y);
            x = this.outX[i];
            y = this.outY[i];
        }
        return total;
    }

    /** Reverses positions i..j, drawing each of those strokes the other way. */
    reverse(i: number, j: number) {
        for (; i <= j; i++, j--) {
            this.swap(i, j);
            this.flip(i);
            if (i !== j) this.flip(j);
        }
    }

    private swap(i: number, j: number) {
        for (const a of [this.stroke, this.k, this.rev, this.inX, this.inY, this.outX, this.outY]) {
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
    }

    private flip(i: number) {
        this.rev[i] ^= 1;
        let t = this.inX[i];
        this.inX[i] = this.outX[i];
        this.outX[i] = t;
        t = this.inY[i];
        this.inY[i] = this.outY[i];
        this.outY[i] = t;
    }
}

// ---------------------------------------------------------------------------------------
// Greedy nearest neighbour on a spatial grid

/**
 * Points where the pen can enter a stroke, bucketed in a uniform grid. Entries of used
 * strokes are dropped lazily, as cells are scanned.
 */
class EntryGrid {
    private readonly minX: number;
    private readonly minY: number;
    private readonly size: number;
    private readonly cols: number;
    private readonly rows: number;
    private readonly cellStart: Int32Array;
    private readonly cellEnd: Int32Array;
    private readonly items: Int32Array;

    constructor(
        private readonly x: Float64Array,
        private readonly y: Float64Array,
        private readonly owner: Int32Array,
        private readonly alive: Uint8Array,
    ) {
        const count = x.length;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < count; i++) {
            minX = Math.min(minX, x[i]);
            minY = Math.min(minY, y[i]);
            maxX = Math.max(maxX, x[i]);
            maxY = Math.max(maxY, y[i]);
        }
        const width = maxX - minX;
        const height = maxY - minY;

        // About two entries per cell.
        const cells = Math.max(1, Math.ceil(count / 2));
        let size = Math.sqrt((width * height) / cells);
        if (!(size > 0)) size = Math.max(width, height) / cells;
        if (!(size > 0)) size = 1;
        let cols = Math.floor(width / size) + 1;
        let rows = Math.floor(height / size) + 1;
        while (cols * rows > 4 * count + 16) {
            size *= 1.5;
            cols = Math.floor(width / size) + 1;
            rows = Math.floor(height / size) + 1;
        }

        this.minX = minX;
        this.minY = minY;
        this.size = size;
        this.cols = cols;
        this.rows = rows;

        const cellOf = new Int32Array(count);
        const cellStart = new Int32Array(cols * rows + 1);
        for (let i = 0; i < count; i++) {
            const col = Math.floor((x[i] - minX) / size);
            const row = Math.floor((y[i] - minY) / size);
            cellOf[i] = row * cols + col;
            cellStart[cellOf[i] + 1]++;
        }
        for (let c = 0; c < cols * rows; c++) cellStart[c + 1] += cellStart[c];
        const fill = cellStart.slice(0, cols * rows);
        const items = new Int32Array(count);
        for (let i = 0; i < count; i++) items[fill[cellOf[i]]++] = i;

        this.cellStart = cellStart;
        this.cellEnd = cellStart.slice(1);
        this.items = items;
    }

    /** The live entry nearest (qx, qy), lowest index on ties; -1 when none is left. */
    nearest(qx: number, qy: number): number {
        const { cols, rows, size } = this;
        const cx = Math.floor((qx - this.minX) / size);
        const cy = Math.floor((qy - this.minY) / size);
        let best = -1;
        let bestD = Infinity;

        const scan = (col: number, row: number) => {
            const c = row * cols + col;
            for (let p = this.cellStart[c]; p < this.cellEnd[c]; p++) {
                const e = this.items[p];
                if (!this.alive[this.owner[e]]) {
                    this.items[p--] = this.items[--this.cellEnd[c]];
                    continue;
                }
                const d = (this.x[e] - qx) ** 2 + (this.y[e] - qy) ** 2;
                if (d < bestD || (d === bestD && e < best)) {
                    best = e;
                    bestD = d;
                }
            }
        };

        // Rings of cells around the query's cell. Ring r is at least (r − 1)·size away.
        // A query off the grid (the start point) starts at the first ring that touches it.
        const r0 = Math.max(0, -cx, cx - (cols - 1), -cy, cy - (rows - 1));
        for (let r = r0; ; r++) {
            if (best >= 0 && r >= 1 && bestD <= ((r - 1) * size) ** 2) break;
            const x0 = cx - r;
            const x1 = cx + r;
            const y0 = cy - r;
            const y1 = cy + r;
            const colFrom = Math.max(0, x0);
            const colTo = Math.min(cols - 1, x1);
            if (y0 >= 0 && y0 < rows) for (let col = colFrom; col <= colTo; col++) scan(col, y0);
            if (r > 0 && y1 >= 0 && y1 < rows) for (let col = colFrom; col <= colTo; col++) scan(col, y1);
            const rowFrom = Math.max(0, y0 + 1);
            const rowTo = Math.min(rows - 1, y1 - 1);
            if (r > 0 && x0 >= 0 && x0 < cols) for (let row = rowFrom; row <= rowTo; row++) scan(x0, row);
            if (r > 0 && x1 >= 0 && x1 < cols) for (let row = rowFrom; row <= rowTo; row++) scan(x1, row);
            // This ring reached every edge of the grid: nothing is left beyond it.
            if (x0 <= 0 && y0 <= 0 && x1 >= cols - 1 && y1 >= rows - 1) break;
        }
        return best;
    }
}

/**
 * Greedy nearest neighbour from the start point. An open stroke can be entered at either
 * end, a loop at any vertex. A gap loop entered at its last vertex is drawn backwards, so
 * the gap isn't drawn.
 */
function greedyTour(strokes: Stroke[], start: Point): Tour {
    const ex: number[] = [];
    const ey: number[] = [];
    const owner: number[] = [];
    const vertex: number[] = [];
    strokes.forEach((stroke, s) => {
        const last = stroke.x.length - 1;
        const vertices =
            stroke.shape === OPEN ? (last > 0 ? [0, last] : [0]) : Array.from({ length: stroke.shape === LOOP ? last : last + 1 }, (_, v) => v);
        for (const v of vertices) {
            ex.push(stroke.x[v]);
            ey.push(stroke.y[v]);
            owner.push(s);
            vertex.push(v);
        }
    });

    const alive = new Uint8Array(strokes.length).fill(1);
    const grid = new EntryGrid(Float64Array.from(ex), Float64Array.from(ey), Int32Array.from(owner), alive);
    const tour = new Tour(strokes, start);
    let qx = start.x;
    let qy = start.y;

    for (let i = 0; i < strokes.length; i++) {
        const e = grid.nearest(qx, qy);
        if (e < 0) throw new Error("pathOptimizer: ran out of strokes");
        const s = owner[e];
        const stroke = strokes[s];
        const v = vertex[e];
        const last = stroke.x.length - 1;
        if (stroke.shape === LOOP) tour.set(i, s, v, false);
        else if (v === 0 || v === last) tour.set(i, s, 0, v === last && last > 0);
        else tour.set(i, s, v, false);
        alive[s] = 0;
        qx = tour.outX[i];
        qy = tour.outY[i];
    }
    return tour;
}

/** The strokes as svg-to-gcode ordered them. */
function convertedTour(strokes: Stroke[], start: Point): Tour {
    const tour = new Tour(strokes, start);
    for (let i = 0; i < strokes.length; i++) tour.set(i, i, 0, false);
    return tour;
}

// ---------------------------------------------------------------------------------------
// Local improvement

/**
 * 2-opt on an open path with a fixed start: reversing positions i..j (drawing each of
 * those strokes the other way) replaces the gaps before i and after j. i = j flips one
 * stroke. Runs until no move helps or the deadline passes.
 */
function twoOpt(tour: Tour, deadline: number) {
    const n = tour.length;
    const { inX, inY, outX, outY } = tour;
    let improved = true;

    while (improved) {
        improved = false;
        for (let i = 0; i < n; i++) {
            if (performance.now() > deadline) return;
            const px = i === 0 ? tour.start.x : outX[i - 1];
            const py = i === 0 ? tour.start.y : outY[i - 1];
            for (let j = i; j < n; j++) {
                const hasNext = j + 1 < n;
                const before = dist(px, py, inX[i], inY[i]) + (hasNext ? dist(outX[j], outY[j], inX[j + 1], inY[j + 1]) : 0);
                const after = dist(px, py, outX[j], outY[j]) + (hasNext ? dist(inX[i], inY[i], inX[j + 1], inY[j + 1]) : 0);
                if (after < before - MIN_GAIN) {
                    tour.reverse(i, j);
                    improved = true;
                }
            }
        }
    }
}

/**
 * Restarts each loop at the vertex closest to its neighbours in the tour, since 2-opt
 * can't move where a loop starts. Says whether anything changed.
 */
function rotateLoops(tour: Tour): boolean {
    const n = tour.length;
    let changed = false;

    for (let i = 0; i < n; i++) {
        const stroke = tour.strokes[tour.stroke[i]];
        if (stroke.shape === OPEN) continue;
        const px = i === 0 ? tour.start.x : tour.outX[i - 1];
        const py = i === 0 ? tour.start.y : tour.outY[i - 1];
        const hasNext = i + 1 < n;
        const nx = hasNext ? tour.inX[i + 1] : 0;
        const ny = hasNext ? tour.inY[i + 1] : 0;
        const cost = (ax: number, ay: number, bx: number, by: number) =>
            Math.hypot(ax - px, ay - py) + (hasNext ? Math.hypot(nx - bx, ny - by) : 0);

        let bestCost = cost(tour.inX[i], tour.inY[i], tour.outX[i], tour.outY[i]) - MIN_GAIN;
        let bestK = -1;
        let bestRev = false;
        const consider = (c: number, k: number, rev: boolean) => {
            if (c >= bestCost) return;
            bestCost = c;
            bestK = k;
            bestRev = rev;
        };
        const { x, y } = stroke;
        const last = x.length - 1;

        // A loop's last vertex repeats vertex 0. A gap loop starting at vertex 0 is drawn
        // unrotated, either way round, and its other vertices are rotations.
        if (stroke.shape === LOOP) {
            for (let v = 0; v < last; v++) consider(cost(x[v], y[v], x[v], y[v]), v, false);
        } else {
            for (let v = 1; v < last; v++) consider(cost(x[v], y[v], x[v], y[v]), v, false);
            consider(cost(x[0], y[0], x[last], y[last]), 0, false);
            consider(cost(x[last], y[last], x[0], y[0]), 0, true);
        }

        if (bestK >= 0) {
            tour.set(i, tour.stroke[i], bestK, bestRev);
            changed = true;
        }
    }
    return changed;
}

// ---------------------------------------------------------------------------------------
// Output

const fmt = (value: number) => String(Number(value.toFixed(3)));

function strokeLength(stroke: Stroke) {
    let total = 0;
    for (let i = 1; i < stroke.x.length; i++) total += dist(stroke.x[i - 1], stroke.y[i - 1], stroke.x[i], stroke.y[i]);
    return total;
}

interface Emitted {
    body: string[];
    lifts: number;
    travel: number;
    draw: number;
    bridges: number;
    bridgedMm: number;
}

/** Writes the tour in svg-to-gcode's format, drawing gaps up to `bridgeMm` pen-down. */
function emit(tour: Tour, bridgeMm: number, zDownLine: string, zUpLine: string): Emitted {
    const body: string[] = [];
    let lifts = 0;
    let travel = 0;
    let draw = 0;
    let bridges = 0;
    let bridgedMm = 0;
    let x = tour.start.x;
    let y = tour.start.y;

    for (let i = 0; i < tour.length; i++) {
        const stroke = tour.strokes[tour.stroke[i]];
        const order = drawOrder(stroke, tour.k[i], tour.rev[i] === 1);
        const sx = stroke.x[order[0]];
        const sy = stroke.y[order[0]];
        const gap = dist(x, y, sx, sy);

        // The pen starts up, so the first stroke is always a travel.
        if (i > 0 && gap <= bridgeMm + 1e-9) {
            if (gap > 0) body.push(`G1 X${fmt(sx)} Y${fmt(sy)}`);
            draw += gap;
            bridges++;
            bridgedMm += gap;
        } else {
            if (i > 0) {
                body.push(zUpLine);
                lifts++;
            }
            body.push(`G0 X${fmt(sx)} Y${fmt(sy)}`, zDownLine);
            travel += gap;
        }

        x = sx;
        y = sy;
        for (let p = 1; p < order.length; p++) {
            const nx = stroke.x[order[p]];
            const ny = stroke.y[order[p]];
            body.push(`G1 X${fmt(nx)} Y${fmt(ny)}`);
            draw += dist(x, y, nx, ny);
            x = nx;
            y = ny;
        }
    }

    body.push(zUpLine);
    lifts++;
    return { body, lifts, travel, draw, bridges, bridgedMm };
}

// ---------------------------------------------------------------------------------------

/**
 * Reorders svg-to-gcode's strokes for less pen-up travel and fewer lifts, and bridges
 * small gaps with the pen down (see the top of this file). Returns the input unchanged,
 * with the reason, when it isn't svg-to-gcode's plain output or there's nothing to do.
 */
export function optimizeGcode(gcode: string, options: OptimizeOptions): OptimizeResult {
    const pass = (reason: string): OptimizeResult => ({ optimized: false, gcode, reason });
    const started = performance.now();
    const { settings } = options;

    // svg-to-gcode with pathPlanning "sortByArea" was asked for that order: keep it.
    if (settings.pathPlanning === "sortByArea") return pass("pathPlanning is sortByArea");

    const zValue = settings.zValue ?? CONVERTER_DEFAULTS.zValue;
    const zOffset = settings.zOffset ?? CONVERTER_DEFAULTS.zOffset;
    const feedRate = settings.feedRate ?? CONVERTER_DEFAULTS.feedRate;
    const zMoveTime = settings.zMoveTime ?? CONVERTER_DEFAULTS.zMoveTime;
    if (![zValue, zOffset, feedRate, zMoveTime].every(Number.isFinite) || !(feedRate > 0)) {
        return pass("unusable converter settings");
    }
    // svg-to-gcode's pen heights and their exact lines (converter.js).
    const zDown = zValue;
    const zUp = zValue < 0 ? zValue + zOffset : zValue - zOffset;
    if (near(zUp, zDown)) return pass("pen up and pen down are the same height");

    const parsed = parse(gcode, zDown, zUp);
    if (typeof parsed === "string") return pass(parsed);
    if (!parsed.runs.length) return pass("no strokes");

    const bridgeMm = options.bridgeMm !== undefined && Number.isFinite(options.bridgeMm) ? Math.max(0, options.bridgeMm) : DEFAULT_BRIDGE_MM;
    // Starting a gap loop elsewhere draws its gap, so only gaps that could be bridged.
    const strokes = parsed.runs.map((run) => toStroke(run, Math.min(CLOSED_MM, bridgeMm)));
    const start = options.start ?? { x: strokes[0].x[0], y: strokes[0].y[0] };

    const converted = convertedTour(strokes, start);
    const greedy = greedyTour(strokes, start);
    // Never worse than svg-to-gcode's own order.
    const tour = greedy.cost() <= converted.cost() ? greedy : converted;

    const canTwoOpt = strokes.length <= TWO_OPT_MAX_STROKES;
    const deadline = performance.now() + (options.timeBudgetMs ?? TWO_OPT_MS);
    do {
        if (canTwoOpt) twoOpt(tour, deadline);
    } while (rotateLoops(tour) && canTwoOpt && performance.now() < deadline);

    const out = emit(tour, bridgeMm, `G0 Z${zDown}`, `G0 Z${zUp}`);

    // svg-to-gcode's time model: every move at the drawing feed, plus a fixed time per Z move.
    const speed = feedRate / 60;
    const drawBefore = strokes.reduce((total, stroke) => total + strokeLength(stroke), 0);
    const travelBefore = converted.cost();
    const liftsBefore = strokes.length;
    const timeBefore = (drawBefore + travelBefore) / speed + 2 * liftsBefore * zMoveTime;
    const timeAfter = (out.draw + out.travel) / speed + 2 * out.lifts * zMoveTime;

    return {
        optimized: true,
        gcode: [...parsed.header, ...out.body].join("\n"),
        time: timeAfter,
        stats: {
            strokes: strokes.length,
            liftsBefore,
            liftsAfter: out.lifts,
            travelBeforeMm: travelBefore,
            travelAfterMm: out.travel,
            bridges: out.bridges,
            bridgedMm: out.bridgedMm,
            timeBefore,
            timeAfter,
            ms: performance.now() - started,
        },
    };
}

/** One line for the log. */
export function describeStats(stats: OptimizeStats, bridgeMm: number): string {
    const mm = (value: number) => value.toFixed(1);
    const s = (value: number) => value.toFixed(0);
    return (
        `[pathOptimizer] ${stats.strokes} strokes, lifts ${stats.liftsBefore}→${stats.liftsAfter}, ` +
        `travel ${mm(stats.travelBeforeMm)}→${mm(stats.travelAfterMm)} mm, ` +
        `time ${s(stats.timeBefore)}→${s(stats.timeAfter)} s, ` +
        `${stats.bridges} bridges (${mm(stats.bridgedMm)} mm, ≤${bridgeMm} mm), ${s(stats.ms)} ms`
    );
}
