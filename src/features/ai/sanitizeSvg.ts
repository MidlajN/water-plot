import { XMLParser, XMLValidator } from "fast-xml-parser";

import { UPLOAD_MAX_BYTES } from "../uploads/messages";
import { MARGIN_MM } from "./constants";

/**
 * Turns untrusted (model-generated) SVG into a plotter-safe SVG.
 *
 * The input is parsed as XML and a brand-new document is written from an allowlist:
 * only simple stroke geometry survives, every attribute value is checked to be plain
 * numbers, path data is re-serialised from its parsed form, and the drawing is fitted
 * into a box inside the working area. Anything that could reference external content
 * or run code (scripts, event handlers, links, images, CSS, foreign content) rejects the
 * whole SVG.
 */

export const SVG_LIMITS = {
    maxBytes: 200_000,
    maxElements: 500,
    maxPathChars: 60_000,
    maxDepth: 6,
    marginMm: MARGIN_MM,
    /** Boxes smaller than this (mm) are ignored in favour of the whole working area. */
    minBoxMm: 20,
    strokeWidthMm: 0.8,
} as const;

export interface FitBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type SanitizeResult =
    | { ok: true; svg: string; box: FitBox; stats: { elements: number; pathChars: number } }
    | { ok: false; reasons: string[] };

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Elements dropped silently (with their content): metadata only. */
const IGNORED_ELEMENTS = new Set(["title", "desc", "metadata"]);

/** Geometry attributes kept per element (validated); `transform` is allowed on all but svg. */
const GEOMETRY: Record<string, string[]> = {
    svg: [],
    g: [],
    path: ["d"],
    line: ["x1", "y1", "x2", "y2"],
    polyline: ["points"],
    polygon: ["points"],
    circle: ["cx", "cy", "r"],
    ellipse: ["cx", "cy", "rx", "ry"],
    rect: ["x", "y", "width", "height", "rx", "ry"],
};

/** Harmless attributes that are dropped (the output sets its own styling). */
const DROPPED_ATTRIBUTES = new Set([
    "xmlns",
    "xmlns:xlink",
    "version",
    "viewBox",
    "width",
    "height",
    "preserveAspectRatio",
    "fill",
    "fill-rule",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "vector-effect",
    "id",
    "class",
    "style",
]);

const DANGEROUS_VALUE = /url\s*\(|javascript:|data:|@import|expression\s*\(|<|&#/i;
const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:px)?$/;

class Rejection extends Error {}

function parseNumber(value: string, name: string): number {
    const trimmed = value.trim();
    if (!NUMBER.test(trimmed)) throw new Rejection(`attribute ${name} is not a plain number`);
    const number = parseFloat(trimmed);
    if (!Number.isFinite(number)) throw new Rejection(`attribute ${name} is not finite`);
    return number;
}

function parseNumberList(value: string, name: string): number[] {
    const parts = value.trim().split(/[\s,]+/).filter(Boolean);
    return parts.map((part) => parseNumber(part, name));
}

const fmt = (value: number) => String(Math.round(value * 1000) / 1000);

// ---------------------------------------------------------------------------
// Transforms

const multiply = (a: Matrix, b: Matrix): Matrix => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
];

const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function parseTransform(value: string): Matrix {
    let matrix = IDENTITY;
    const pattern = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)\s*,?/gy;
    let consumed = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value))) {
        consumed = pattern.lastIndex;
        const [, kind, rawArgs] = match;
        const args = parseNumberList(rawArgs, "transform");
        const rad = (deg: number) => (deg * Math.PI) / 180;
        let step: Matrix;

        if (kind === "matrix" && args.length === 6) step = args as Matrix;
        else if (kind === "translate" && (args.length === 1 || args.length === 2)) step = [1, 0, 0, 1, args[0], args[1] ?? 0];
        else if (kind === "scale" && (args.length === 1 || args.length === 2)) step = [args[0], 0, 0, args[1] ?? args[0], 0, 0];
        else if (kind === "rotate" && (args.length === 1 || args.length === 3)) {
            const [angle, cx = 0, cy = 0] = args;
            const cos = Math.cos(rad(angle));
            const sin = Math.sin(rad(angle));
            step = multiply(multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
        } else if (kind === "skewX" && args.length === 1) step = [1, 0, Math.tan(rad(args[0])), 1, 0, 0];
        else if (kind === "skewY" && args.length === 1) step = [1, Math.tan(rad(args[0])), 0, 1, 0, 0];
        else throw new Rejection(`transform ${kind} has the wrong number of values`);

        matrix = multiply(matrix, step);
    }

    if (value.slice(consumed).trim()) throw new Rejection("transform has unsupported content");
    return matrix;
}

// ---------------------------------------------------------------------------
// Bounds

class Bounds {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;

    add(x: number, y: number) {
        this.minX = Math.min(this.minX, x);
        this.minY = Math.min(this.minY, y);
        this.maxX = Math.max(this.maxX, x);
        this.maxY = Math.max(this.maxY, y);
    }

    /** Adds a local axis-aligned box after transforming its corners. */
    addBox(m: Matrix, minX: number, minY: number, maxX: number, maxY: number) {
        for (const [x, y] of [
            [minX, minY],
            [maxX, minY],
            [minX, maxY],
            [maxX, maxY],
        ]) {
            this.add(...apply(m, x, y));
        }
    }

    get empty() {
        return !Number.isFinite(this.minX);
    }
}

// ---------------------------------------------------------------------------
// Path data

const PARAMS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Parses and re-serialises path data, adding a conservative hull of every segment to
 * `bounds` (end and control points; arcs by the region their circle can reach). Numbers
 * are written with `format` (the AI path's 3-decimal `fmt` by default).
 */
function sanitizePath(d: string, m: Matrix, bounds: Bounds, format: (value: number) => string = fmt): string {
    let i = 0;
    const out: string[] = [];
    const length = d.length;

    const skipSeparators = () => {
        while (i < length && /[\s,]/.test(d[i])) i++;
    };
    const readNumber = (): number => {
        skipSeparators();
        const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i, i + 40));
        if (!match) throw new Rejection("path data has an invalid number");
        i += match[0].length;
        const value = parseFloat(match[0]);
        if (!Number.isFinite(value)) throw new Rejection("path data has a non-finite number");
        return value;
    };
    const readFlag = (): number => {
        skipSeparators();
        const char = d[i];
        if (char !== "0" && char !== "1") throw new Rejection("path data has an invalid arc flag");
        i++;
        return Number(char);
    };

    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let command = "";
    // Last control points, for the mirrored control point of S and T.
    let lastCubic: [number, number] | null = null;
    let lastQuad: [number, number] | null = null;
    const local = new Bounds();

    while (true) {
        skipSeparators();
        if (i >= length) break;

        if (/[MmLlHhVvCcSsQqTtAaZz]/.test(d[i])) {
            command = d[i++];
        } else if (!command || /[Zz]/.test(command)) {
            throw new Rejection("path data has an unexpected character");
        }
        // After a moveto, implicit repeats are linetos.
        const upper = command.toUpperCase();
        const relative = command !== upper;
        const count = PARAMS[upper];

        if (count === 0) {
            out.push("Z");
            x = startX;
            y = startY;
            lastCubic = lastQuad = null;
            continue;
        }

        const values: number[] = [];
        for (let p = 0; p < count; p++) values.push(upper === "A" && (p === 3 || p === 4) ? readFlag() : readNumber());

        const ox = relative ? x : 0;
        const oy = relative ? y : 0;

        let cubic: [number, number] | null = null;
        let quad: [number, number] | null = null;

        switch (upper) {
            case "M":
                x = values[0] + ox;
                y = values[1] + oy;
                startX = x;
                startY = y;
                out.push(`M${format(x)} ${format(y)}`);
                local.add(x, y);
                command = relative ? "l" : "L";
                break;
            case "L":
            case "H":
            case "V":
                if (upper !== "V") x = values[0] + ox;
                if (upper === "L") y = values[1] + oy;
                if (upper === "V") y = values[0] + oy;
                out.push(`L${format(x)} ${format(y)}`);
                local.add(x, y);
                break;
            case "C":
            case "S":
            case "Q": {
                const points: number[] = [];
                for (let p = 0; p < values.length; p += 2) points.push(values[p] + ox, values[p + 1] + oy);
                if (upper === "S") {
                    const [rx, ry] = lastCubic ? [2 * x - lastCubic[0], 2 * y - lastCubic[1]] : [x, y];
                    local.add(rx, ry);
                }
                for (let p = 0; p < points.length; p += 2) local.add(points[p], points[p + 1]);
                out.push(`${upper}${points.map(format).join(" ")}`);
                const n = points.length;
                if (upper === "Q") quad = [points[0], points[1]];
                else cubic = [points[n - 4], points[n - 3]];
                x = points[n - 2];
                y = points[n - 1];
                break;
            }
            case "T": {
                quad = lastQuad ? [2 * x - lastQuad[0], 2 * y - lastQuad[1]] : [x, y];
                local.add(quad[0], quad[1]);
                x = values[0] + ox;
                y = values[1] + oy;
                out.push(`T${format(x)} ${format(y)}`);
                local.add(x, y);
                break;
            }
            case "A": {
                const [rx, ry, rotation, large, sweep] = values;
                const ex = values[5] + ox;
                const ey = values[6] + oy;
                const r = Math.max(Math.abs(rx), Math.abs(ry), Math.hypot(ex - x, ey - y) / 2);
                // Every arc point is within 2r of both endpoints.
                local.add(Math.max(x, ex) - 2 * r, Math.max(y, ey) - 2 * r);
                local.add(Math.min(x, ex) + 2 * r, Math.min(y, ey) + 2 * r);
                out.push(`A${format(Math.abs(rx))} ${format(Math.abs(ry))} ${format(rotation)} ${large} ${sweep} ${format(ex)} ${format(ey)}`);
                x = ex;
                y = ey;
                break;
            }
        }
        lastCubic = cubic;
        lastQuad = quad;
    }

    if (!out.length || !out[0].startsWith("M")) throw new Rejection("path data must start with a moveto");
    if (!local.empty) bounds.addBox(m, local.minX, local.minY, local.maxX, local.maxY);
    return out.join(" ");
}

// ---------------------------------------------------------------------------
// Tree walk

type XmlNode = Record<string, unknown> & { ":@"?: Record<string, string> };

interface WalkState {
    elements: number;
    pathChars: number;
    bounds: Bounds;
}

function elementName(node: XmlNode): string | null {
    const key = Object.keys(node).find((name) => name !== ":@");
    return key ?? null;
}

function checkAttributes(name: string, attributes: Record<string, string>): Record<string, string> {
    const kept: Record<string, string> = {};
    const allowed = new Set([...GEOMETRY[name], ...(name === "svg" ? [] : ["transform"])]);

    for (const [rawKey, rawValue] of Object.entries(attributes)) {
        const key = rawKey.replace(/^@_/, "");
        const value = String(rawValue);
        if (/^on/i.test(key)) throw new Rejection(`event handler attribute ${key} is not allowed`);
        if (/(^|:)href$/i.test(key)) throw new Rejection("links (href) are not allowed");
        if (DANGEROUS_VALUE.test(value)) throw new Rejection(`attribute ${key} references external or active content`);
        if (allowed.has(key)) kept[key] = value;
        else if (!DROPPED_ATTRIBUTES.has(key) && !key.startsWith("data-") && !key.startsWith("aria-")) {
            throw new Rejection(`attribute ${key} is not allowed on <${name}>`);
        }
    }
    return kept;
}

function emitElement(name: string, attributes: Record<string, string>, parent: Matrix, state: WalkState): { markup: string; matrix: Matrix } {
    const matrix = attributes.transform !== undefined ? multiply(parent, parseTransform(attributes.transform)) : parent;
    const out: Record<string, string> = {};
    if (attributes.transform !== undefined) out.transform = `matrix(${parseTransform(attributes.transform).map(fmt).join(" ")})`;

    const num = (key: string, fallback?: number) => {
        if (attributes[key] === undefined) {
            if (fallback === undefined) throw new Rejection(`<${name}> is missing ${key}`);
            return fallback;
        }
        return parseNumber(attributes[key], key);
    };

    switch (name) {
        case "path": {
            const d = attributes.d ?? "";
            state.pathChars += d.length;
            if (state.pathChars > SVG_LIMITS.maxPathChars) throw new Rejection("path data is too long");
            out.d = sanitizePath(d, matrix, state.bounds);
            break;
        }
        case "line": {
            const [x1, y1, x2, y2] = [num("x1", 0), num("y1", 0), num("x2", 0), num("y2", 0)];
            Object.assign(out, { x1: fmt(x1), y1: fmt(y1), x2: fmt(x2), y2: fmt(y2) });
            state.bounds.add(...apply(matrix, x1, y1));
            state.bounds.add(...apply(matrix, x2, y2));
            break;
        }
        case "polyline":
        case "polygon": {
            const values = parseNumberList(attributes.points ?? "", "points");
            if (values.length < 4 || values.length % 2) throw new Rejection(`<${name}> points must be coordinate pairs`);
            for (let p = 0; p < values.length; p += 2) state.bounds.add(...apply(matrix, values[p], values[p + 1]));
            out.points = values.map(fmt).join(" ");
            break;
        }
        case "circle": {
            const [cx, cy, r] = [num("cx", 0), num("cy", 0), num("r")];
            if (r <= 0) throw new Rejection("<circle> radius must be positive");
            Object.assign(out, { cx: fmt(cx), cy: fmt(cy), r: fmt(r) });
            state.bounds.addBox(matrix, cx - r, cy - r, cx + r, cy + r);
            break;
        }
        case "ellipse": {
            const [cx, cy, rx, ry] = [num("cx", 0), num("cy", 0), num("rx"), num("ry")];
            if (rx <= 0 || ry <= 0) throw new Rejection("<ellipse> radii must be positive");
            Object.assign(out, { cx: fmt(cx), cy: fmt(cy), rx: fmt(rx), ry: fmt(ry) });
            state.bounds.addBox(matrix, cx - rx, cy - ry, cx + rx, cy + ry);
            break;
        }
        case "rect": {
            const [x, y, width, height] = [num("x", 0), num("y", 0), num("width"), num("height")];
            if (width <= 0 || height <= 0) throw new Rejection("<rect> size must be positive");
            Object.assign(out, { x: fmt(x), y: fmt(y), width: fmt(width), height: fmt(height) });
            if (attributes.rx !== undefined) out.rx = fmt(num("rx"));
            if (attributes.ry !== undefined) out.ry = fmt(num("ry"));
            state.bounds.addBox(matrix, x, y, x + width, y + height);
            break;
        }
    }

    const attrs = Object.entries(out)
        .map(([key, value]) => ` ${key}="${value}"`)
        .join("");
    return { markup: `<${name}${attrs}`, matrix };
}

function walk(nodes: XmlNode[], parent: Matrix, depth: number, state: WalkState): string {
    let markup = "";

    for (const node of nodes) {
        const name = elementName(node);
        if (!name || name === "#text") continue;
        if (name === "#comment" || name.startsWith("?")) continue;
        if (IGNORED_ELEMENTS.has(name)) continue;
        if (!(name in GEOMETRY) || name === "svg") throw new Rejection(`element <${name}> is not allowed`);

        state.elements++;
        if (state.elements > SVG_LIMITS.maxElements) throw new Rejection(`more than ${SVG_LIMITS.maxElements} elements`);

        const attributes = checkAttributes(name, node[":@"] ?? {});
        const { markup: open, matrix } = emitElement(name, attributes, parent, state);
        const children = (node[name] as XmlNode[]) ?? [];

        if (name === "g") {
            if (depth >= SVG_LIMITS.maxDepth) throw new Rejection("groups are nested too deeply");
            const inner = walk(children, matrix, depth + 1, state);
            if (inner) markup += `${open}>${inner}</g>`;
        } else {
            // Drawable elements may only contain metadata.
            for (const child of children) {
                const childName = elementName(child);
                if (childName && childName !== "#text" && !IGNORED_ELEMENTS.has(childName)) {
                    throw new Rejection(`element <${childName}> is not allowed`);
                }
            }
            markup += `${open}/>`;
        }
    }

    return markup;
}

// ---------------------------------------------------------------------------

/**
 * Validates and rebuilds `svg`, fitting the drawing into `target` (mm), which is first
 * clamped inside the working area minus the margin. The output is always the full
 * working area: width/height in mm with a matching viewBox.
 */
export function sanitizeSvg(svg: string, area: { width: number; height: number }, target?: FitBox | null): SanitizeResult {
    try {
        if (new TextEncoder().encode(svg).byteLength > SVG_LIMITS.maxBytes) throw new Rejection("SVG is too large");
        if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?xml-stylesheet/i.test(svg)) throw new Rejection("DTDs, entities, CDATA and stylesheets are not allowed");
        if (XMLValidator.validate(svg) !== true) throw new Rejection("SVG is not well-formed XML");

        const parser = new XMLParser({
            preserveOrder: true,
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseTagValue: false,
            parseAttributeValue: false,
            processEntities: false,
            htmlEntities: false,
            trimValues: true,
            commentPropName: "#comment",
        });
        const document = parser.parse(svg) as XmlNode[];
        const roots = document.filter((node) => {
            const name = elementName(node);
            return name && name !== "#text" && name !== "#comment" && !name.startsWith("?");
        });
        if (roots.length !== 1 || elementName(roots[0]) !== "svg") throw new Rejection("the document must have a single <svg> root");

        const root = roots[0];
        checkAttributes("svg", root[":@"] ?? {});

        const state: WalkState = { elements: 0, pathChars: 0, bounds: new Bounds() };
        const body = walk((root.svg as XmlNode[]) ?? [], IDENTITY, 0, state);
        if (!body || state.bounds.empty) throw new Rejection("the SVG has nothing to draw");

        const box = fitBox(area, target);
        const { minX, minY, maxX, maxY } = state.bounds;
        const width = maxX - minX;
        const height = maxY - minY;
        if (width <= 0 && height <= 0) throw new Rejection("the SVG has nothing to draw");

        const scale = Math.min(width > 0 ? box.width / width : Infinity, height > 0 ? box.height / height : Infinity);
        const tx = box.x + (box.width - width * scale) / 2 - minX * scale;
        const ty = box.y + (box.height - height * scale) / 2 - minY * scale;
        const fitted = { x: box.x + (box.width - width * scale) / 2, y: box.y + (box.height - height * scale) / 2, width: width * scale, height: height * scale };

        const output =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(area.width)}mm" height="${fmt(area.height)}mm" viewBox="0 0 ${fmt(area.width)} ${fmt(area.height)}" ` +
            `fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">` +
            `<g transform="matrix(${fmt(scale)} 0 0 ${fmt(scale)} ${fmt(tx)} ${fmt(ty)})" stroke-width="${fmt(SVG_LIMITS.strokeWidthMm / scale)}">` +
            `${body}</g></svg>`;

        return {
            ok: true,
            svg: output,
            box: { x: round(fitted.x), y: round(fitted.y), width: round(fitted.width), height: round(fitted.height) },
            stats: { elements: state.elements, pathChars: state.pathChars },
        };
    } catch (error) {
        if (error instanceof Rejection) return { ok: false, reasons: [error.message] };
        return { ok: false, reasons: ["the SVG couldn't be read"] };
    }
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The target box clamped inside the working area minus the margin (or the whole safe area). */
export function fitBox(area: { width: number; height: number }, target?: FitBox | null): FitBox {
    const m = SVG_LIMITS.marginMm;
    const safe = { x: m, y: m, width: area.width - 2 * m, height: area.height - 2 * m };
    if (!target || ![target.x, target.y, target.width, target.height].every(Number.isFinite)) return safe;

    const x = Math.min(Math.max(target.x, safe.x), safe.x + safe.width);
    const y = Math.min(Math.max(target.y, safe.y), safe.y + safe.height);
    const width = Math.min(target.width, safe.x + safe.width - x);
    const height = Math.min(target.height, safe.y + safe.height - y);
    if (width < SVG_LIMITS.minBoxMm || height < SVG_LIMITS.minBoxMm) return safe;
    return { x, y, width, height };
}

// ---------------------------------------------------------------------------
// Uploads
//
// Real-world files (Illustrator, Inkscape, Figma, icon packs) carry DOCTYPEs, <defs>,
// <style>, text, editor attributes and hidden layers. Instead of rejecting them, upload
// mode keeps only the drawable geometry and drops everything else. That is as safe as
// rejecting: the output is still written from scratch with allowlisted tag names and
// re-formatted numbers; no attribute value is ever copied through.

export const UPLOAD_LIMITS = {
    maxBytes: UPLOAD_MAX_BYTES,
    maxElements: 3000,
    maxPathChars: 300_000,
    maxDepth: 32,
} as const;

/** Things left out of an upload that the person may want to know about. */
export type UploadNote = "text" | "images" | "links" | "skipped";

export type UploadSanitizeResult =
    | { ok: true; svg: string; notes: UploadNote[] }
    | { ok: false; code: "too_large" | "not_svg" | "empty" | "too_complex" | "too_deep"; notes: UploadNote[] };

/** A size limit: always fails the whole upload, never just the element. */
class LimitRejection extends Error {
    constructor(readonly code: "too_complex" | "too_deep") {
        super(code);
    }
}

const CONTAINERS = new Set(["g", "a", "switch", "svg"]);
const DRAWABLE = new Set(["path", "line", "polyline", "polygon", "circle", "ellipse", "rect"]);
const NOTED: Record<string, UploadNote> = { text: "text", tspan: "text", textPath: "text", image: "images", use: "links" };

/** Up to 7 significant digits, so tiny scales and large coordinates both survive. */
const precise = (value: number) => String(Number(value.toPrecision(7)));

interface Paint {
    fill: boolean;
    stroke: boolean;
    visible: boolean;
}

interface UploadState {
    elements: number;
    pathChars: number;
    bounds: Bounds;
    notes: Set<UploadNote>;
}

/** Properties an inline `style` may set here: paint and visibility, never geometry. */
const STYLE_PROPERTIES = new Set(["fill", "stroke", "fill-opacity", "stroke-opacity", "opacity", "display", "visibility"]);

/** Attributes plus paint and visibility from an inline `style` (style wins, as in CSS). */
function presentation(attributes: Record<string, string>): Record<string, string> {
    const props: Record<string, string> = {};
    for (const [rawKey, value] of Object.entries(attributes)) props[rawKey.replace(/^@_/, "")] = String(value).trim();
    for (const declaration of (props.style ?? "").split(";")) {
        const colon = declaration.indexOf(":");
        const property = declaration.slice(0, colon).trim().toLowerCase();
        if (colon > 0 && STYLE_PROPERTIES.has(property)) props[property] = declaration.slice(colon + 1).replace(/!important/i, "").trim();
    }
    return props;
}

const isZero = (value: string | undefined) => value !== undefined && parseFloat(value) === 0;
const paints = (value: string | undefined, inherited: boolean) =>
    value === undefined || value === "inherit" ? inherited : !/^(none|transparent)$/i.test(value);

/** The paint an element passes down, or null when it (and its content) shows nothing. */
function inheritPaint(props: Record<string, string>, parent: Paint): Paint | null {
    if (props.display === "none" || isZero(props.opacity)) return null;
    const visible = props.visibility === undefined || props.visibility === "inherit" ? parent.visible : props.visibility === "visible";
    return {
        fill: paints(props.fill, parent.fill) && !isZero(props["fill-opacity"]),
        stroke: paints(props.stroke, parent.stroke) && !isZero(props["stroke-opacity"]),
        visible,
    };
}

/** A nested <svg>: its x/y offset, plus its viewBox scaled to fit ("xMidYMid meet"). */
function nestedSvgMatrix(props: Record<string, string>): Matrix {
    const read = (key: string, fallback: number) => (props[key] !== undefined && NUMBER.test(props[key]) ? parseFloat(props[key]) : fallback);
    const x = read("x", 0);
    const y = read("y", 0);
    const box = (props.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
    const width = read("width", NaN);
    const height = read("height", NaN);
    if (box.length !== 4 || !box.every(Number.isFinite) || !(box[2] > 0 && box[3] > 0) || !(width > 0 && height > 0)) {
        return [1, 0, 0, 1, x, y];
    }
    const scale = Math.min(width / box[2], height / box[3]);
    const tx = x + (width - box[2] * scale) / 2 - box[0] * scale;
    const ty = y + (height - box[3] * scale) / 2 - box[1] * scale;
    return [scale, 0, 0, scale, tx, ty];
}

/** Marks a stroke width to fill in once the drawing's size (and so the stroke) is known. */
const STROKE_SLOT = /§([^§]+)§/g;

/**
 * One drawable element as markup, its bounds committed only if all of it parses. Groups
 * aren't written out, so the element carries the whole matrix down to it. A scaling
 * matrix would scale the stroke too, so such an element gets a compensating width.
 */
function emitUploadShape(name: string, props: Record<string, string>, parent: Matrix, state: UploadState): string {
    const matrix = props.transform !== undefined ? multiply(parent, parseTransform(props.transform)) : parent;
    const local = new Bounds();
    const out: Record<string, string> = {};
    if (matrix.some((value, index) => value !== IDENTITY[index])) {
        out.transform = `matrix(${matrix.map(precise).join(" ")})`;
        const scale = Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]));
        if (scale > 0 && Math.abs(scale - 1) > 1e-6) out["stroke-width"] = `§${scale}§`;
    }

    const num = (key: string, fallback?: number) => {
        if (props[key] === undefined) {
            if (fallback === undefined) throw new Rejection(`<${name}> is missing ${key}`);
            return fallback;
        }
        return parseNumber(props[key], key);
    };

    switch (name) {
        case "path": {
            const d = props.d ?? "";
            state.pathChars += d.length;
            if (state.pathChars > UPLOAD_LIMITS.maxPathChars) throw new LimitRejection("too_complex");
            out.d = sanitizePath(d, matrix, local, precise);
            break;
        }
        case "line": {
            const [x1, y1, x2, y2] = [num("x1", 0), num("y1", 0), num("x2", 0), num("y2", 0)];
            Object.assign(out, { x1: precise(x1), y1: precise(y1), x2: precise(x2), y2: precise(y2) });
            local.add(...apply(matrix, x1, y1));
            local.add(...apply(matrix, x2, y2));
            break;
        }
        case "polyline":
        case "polygon": {
            const values = parseNumberList(props.points ?? "", "points");
            if (values.length < 4 || values.length % 2) throw new Rejection(`<${name}> points must be coordinate pairs`);
            for (let p = 0; p < values.length; p += 2) local.add(...apply(matrix, values[p], values[p + 1]));
            out.points = values.map(precise).join(" ");
            break;
        }
        case "circle": {
            const [cx, cy, r] = [num("cx", 0), num("cy", 0), num("r")];
            if (r <= 0) throw new Rejection("<circle> radius must be positive");
            Object.assign(out, { cx: precise(cx), cy: precise(cy), r: precise(r) });
            local.addBox(matrix, cx - r, cy - r, cx + r, cy + r);
            break;
        }
        case "ellipse": {
            const [cx, cy, rx, ry] = [num("cx", 0), num("cy", 0), num("rx"), num("ry")];
            if (rx <= 0 || ry <= 0) throw new Rejection("<ellipse> radii must be positive");
            Object.assign(out, { cx: precise(cx), cy: precise(cy), rx: precise(rx), ry: precise(ry) });
            local.addBox(matrix, cx - rx, cy - ry, cx + rx, cy + ry);
            break;
        }
        case "rect": {
            const [x, y, width, height] = [num("x", 0), num("y", 0), num("width"), num("height")];
            if (width <= 0 || height <= 0) throw new Rejection("<rect> size must be positive");
            Object.assign(out, { x: precise(x), y: precise(y), width: precise(width), height: precise(height) });
            if (props.rx !== undefined) out.rx = precise(num("rx"));
            if (props.ry !== undefined) out.ry = precise(num("ry"));
            local.addBox(matrix, x, y, x + width, y + height);
            break;
        }
    }

    if (!local.empty) {
        state.bounds.add(local.minX, local.minY);
        state.bounds.add(local.maxX, local.maxY);
    }
    const attrs = Object.entries(out)
        .map(([key, value]) => ` ${key}="${value}"`)
        .join("");
    return `<${name}${attrs}/>`;
}

function walkUpload(nodes: XmlNode[], parent: Matrix, paint: Paint, depth: number, state: UploadState): string {
    let markup = "";

    for (const node of nodes) {
        const name = elementName(node);
        if (!name || name.startsWith("#") || name.startsWith("?") || name.includes(":")) continue;
        if (NOTED[name]) {
            state.notes.add(NOTED[name]);
            continue;
        }
        if (!CONTAINERS.has(name) && !DRAWABLE.has(name)) continue;

        state.elements++;
        if (state.elements > UPLOAD_LIMITS.maxElements) throw new LimitRejection("too_complex");

        const props = presentation(node[":@"] ?? {});
        const own = inheritPaint(props, paint);
        if (!own) continue;

        if (CONTAINERS.has(name)) {
            if (depth >= UPLOAD_LIMITS.maxDepth) throw new LimitRejection("too_deep");
            let matrix: Matrix;
            try {
                matrix = name === "svg" ? multiply(parent, nestedSvgMatrix(props)) : parent;
                if (props.transform !== undefined) matrix = multiply(matrix, parseTransform(props.transform));
            } catch (error) {
                if (!(error instanceof Rejection)) throw error;
                state.notes.add("skipped");
                continue;
            }
            const inner = walkUpload((node[name] as XmlNode[]) ?? [], matrix, own, depth + 1, state);
            // Groups are flattened into their matrix, so the output needs no nesting.
            markup += inner;
            continue;
        }

        if (!own.visible || (!own.fill && !own.stroke)) continue;
        try {
            markup += emitUploadShape(name, props, parent, state);
        } catch (error) {
            if (!(error instanceof Rejection)) throw error;
            state.notes.add("skipped");
        }
    }

    return markup;
}

/**
 * Turns an uploaded SVG into plotter line art: the drawable geometry only, as round-capped
 * #111 outlines in a tight viewBox (stroke 2% of the longer side, like the built-in art).
 */
export function sanitizeUploadSvg(svg: string): UploadSanitizeResult {
    const state: UploadState = { elements: 0, pathChars: 0, bounds: new Bounds(), notes: new Set() };
    const fail = (code: Extract<UploadSanitizeResult, { ok: false }>["code"]): UploadSanitizeResult => ({ ok: false, code, notes: [...state.notes] });

    try {
        if (new TextEncoder().encode(svg).byteLength > UPLOAD_LIMITS.maxBytes) return fail("too_large");
        if (XMLValidator.validate(svg) !== true) return fail("not_svg");

        const parser = new XMLParser({
            preserveOrder: true,
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseTagValue: false,
            parseAttributeValue: false,
            // Entities are never expanded, so DOCTYPE tricks (billion laughs) do nothing.
            processEntities: false,
            htmlEntities: false,
            trimValues: true,
            commentPropName: "#comment",
        });
        const document = parser.parse(svg) as XmlNode[];
        const roots = document.filter((node) => {
            const name = elementName(node);
            return name && !name.startsWith("#") && !name.startsWith("?");
        });
        if (roots.length !== 1 || elementName(roots[0]) !== "svg") return fail("not_svg");

        // SVG's initial paint: shapes are filled (black) and not stroked.
        const rootPaint = inheritPaint(presentation(roots[0][":@"] ?? {}), { fill: true, stroke: false, visible: true });
        const body = rootPaint ? walkUpload((roots[0].svg as XmlNode[]) ?? [], IDENTITY, rootPaint, 0, state) : "";
        const { minX, minY, maxX, maxY } = state.bounds;
        const longest = Math.max(maxX - minX, maxY - minY);
        if (!body || state.bounds.empty || !(longest > 0)) return fail("empty");

        const stroke = longest * 0.02;
        const viewBox = [minX - stroke, minY - stroke, maxX - minX + 2 * stroke, maxY - minY + 2 * stroke].map(precise).join(" ");
        return {
            ok: true,
            svg:
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="#111" ` +
                `stroke-width="${precise(stroke)}" stroke-linecap="round" stroke-linejoin="round">` +
                `${body.replace(STROKE_SLOT, (_, scale: string) => precise(stroke / Number(scale)))}</svg>`,
            notes: [...state.notes],
        };
    } catch (error) {
        if (error instanceof LimitRejection) return fail(error.code);
        return fail("not_svg");
    }
}
