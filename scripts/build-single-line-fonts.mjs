#!/usr/bin/env node
/**
 * Converts SVG single-line (stroke) fonts into the compact JSON files used by
 * src/features/workspace/text/fonts.
 *
 * Usage:
 *   node scripts/build-single-line-fonts.mjs <svg-font-dir> [FontId ...] [--no-smooth]
 *
 * The EMSL Hershey SVG fonts ship in the `hersheytext` npm package:
 *   npm pack hersheytext && tar xzf hersheytext-*.tgz
 *   node scripts/build-single-line-fonts.mjs package/svg_fonts HersheySans1 HersheyScript1
 *
 * Hershey glyphs are polylines on a coarse grid, so curves look faceted. By
 * default each stroke is smoothed into cubic Béziers that pass through the
 * original points, while sharp turns (corners the letter is meant to have) are
 * kept. --no-smooth writes the original polylines.
 *
 * After adding a font, register it in src/features/workspace/text/fonts/index.ts
 * and make sure its license is covered in fonts/LICENSE.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { routeGlyph } from "./route-strokes.mjs";

const OUT_DIR = resolve(import.meta.dirname, "../src/features/workspace/text/fonts/data");
const DEFAULT_FONTS = ["HersheySans1", "HersheySansMed", "HersheySerifMed", "HersheyScript1"];

/**
 * Corner detection, in degrees of turn at a point:
 * - at least CUSP_ANGLE: always a corner (cusps, retraced strokes, the top of "3").
 * - more than CORNER_ANGLE: a corner, unless it is the tip of a small curve: both
 *   segments around it are at most MAX_TIP_SEGMENT long and the stroke keeps curving the
 *   same way on both sides (by CURVE_THROUGH or more, but short of a cusp). On Hershey's
 *   coarse grid the tips of loops ("l", "b", "f", the tails of "g" and "y") and small
 *   dots turn sharply at one point but are meant to be round, while serifs and the ends
 *   of double-traced stems have long segments and must stay sharp.
 */
const CUSP_ANGLE = 120;
const CORNER_ANGLE = 55;
const CURVE_THROUGH = 20;
const MAX_TIP_SEGMENT = 100;
/** Catmull-Rom parametrisation: 0.5 (centripetal) avoids overshoot and self-loops. */
const ALPHA = 0.5;

/**
 * Glyphs replaced from another font. Hershey Script's digits and several punctuation
 * marks are double-traced (italic duplex) outlines, which a pen draws twice and which
 * look heavier than the letters. They are rebuilt from the Sans 1-stroke glyphs,
 * slanted to match the script (its "1" stem leans about 0.29 horizontally per unit up).
 */
const GLYPH_OVERRIDES = {
  HersheyScript1: {
    source: "HersheySans1",
    chars: "0123456789!\"$&()?@[]{}~",
    shear: 0.29,
    /** Height the shear pivots around, so the glyph stays centred in its advance. */
    pivotY: 331,
  },
};

/**
 * Joined (script) fonts: letters meet at `entry` and `exit` (x is added to the advance).
 * Their strokes are re-routed so each letter is one pen-down from entry to exit and a
 * word plots as a single run (see route-strokes.mjs). `attachSnap` is how far the entry
 * or exit may sit from a stroke and still be joined to it (with a short connector);
 * `stretchExit` lets a letter that stops short of the exit (most capitals) reach it.
 */
const ROUTED_FONTS = {
  HersheyScript1: { entry: [31.5, 158], exit: [31.5, 158], attachSnap: 12, stretchExit: 180 },
};

const args = process.argv.slice(2);
const smooth = !args.includes("--no-smooth");
const [svgDir, ...requested] = args.filter((arg) => !arg.startsWith("--"));

if (!svgDir) {
  console.error("Usage: node scripts/build-single-line-fonts.mjs <svg-font-dir> [FontId ...] [--no-smooth]");
  process.exit(1);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return String.fromCodePoint(point);
    }
    return ENTITIES[code] ?? match;
  });
}

function readAttributes(tag) {
  const attributes = {};
  for (const [, name, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attributes[name] = decodeEntities(value);
  }
  return attributes;
}

/* -------------------------------------------------------------------------
 * Path parsing. The fonts only use absolute M/L/C/Z.
 * ---------------------------------------------------------------------- */

/** Returns subpaths, each a list of commands like ["M", x, y] / ["C", x1, y1, x2, y2, x, y] / ["Z"]. */
function parsePath(d) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const subpaths = [];
  let command = null;

  for (const token of tokens) {
    if (/^[a-zA-Z]$/.test(token)) {
      if (!"MLCZ".includes(token)) throw new Error(`Unsupported path command "${token}" in: ${d}`);
      command = [token];
      if (token === "M") subpaths.push([]);
      subpaths[subpaths.length - 1].push(command);
    } else {
      command.push(Number(token));
    }
  }
  return subpaths;
}

function serialize(subpaths) {
  return subpaths
    .flat()
    .map(([op, ...coords]) => [op, ...coords.map((value) => Math.round(value))].join(" "))
    .join(" ");
}

/* -------------------------------------------------------------------------
 * Smoothing
 * ---------------------------------------------------------------------- */

const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mirror = (point, about) => [2 * point[0] - about[0], 2 * point[1] - about[1]];

/** Signed turn in degrees at `point` (positive = counter-clockwise). */
function turnAngle(previous, point, next) {
  const ax = point[0] - previous[0], ay = point[1] - previous[1];
  const bx = next[0] - point[0], by = next[1] - point[1];
  return (Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI;
}

/** Whether point i stays a sharp corner; `at(i)` returns the point or undefined past an open end. */
function isCornerAt(at, i) {
  const turn = (j) => (at(j - 1) && at(j) && at(j + 1) ? turnAngle(at(j - 1), at(j), at(j + 1)) : undefined);
  const here = turn(i);
  if (here === undefined || Math.abs(here) <= CORNER_ANGLE) return false;
  if (Math.abs(here) >= CUSP_ANGLE) return true;

  const shortSegments = [at(i - 1), at(i + 1)].every((point) => distance(point, at(i)) <= MAX_TIP_SEGMENT);
  const neighbours = [turn(i - 1), turn(i + 1)].filter((value) => value !== undefined);
  const curvesThrough =
    neighbours.length > 0 &&
    neighbours.every(
      (value) =>
        Math.sign(value) === Math.sign(here) && Math.abs(value) >= CURVE_THROUGH && Math.abs(value) < CUSP_ANGLE,
    );
  return !(shortSegments && curvesThrough);
}

/**
 * Cubic Bézier control points for the p1 -> p2 segment of a centripetal
 * Catmull-Rom spline through p0, p1, p2, p3 (Yuksel et al.).
 */
function catmullRomSegment(p0, p1, p2, p3) {
  const d1 = distance(p0, p1) ** ALPHA;
  const d2 = distance(p1, p2) ** ALPHA;
  const d3 = distance(p2, p3) ** ALPHA;

  const control = (near, far, through, dNear, dFar) =>
    [0, 1].map(
      (axis) =>
        (dNear ** 2 * far[axis] - dFar ** 2 * near[axis] + (2 * dNear ** 2 + 3 * dNear * dFar + dFar ** 2) * through[axis]) /
        (3 * dNear * (dNear + dFar)),
    );

  const c1 = d1 > 0 ? control(p0, p2, p1, d1, d2) : p1;
  const c2 = d3 > 0 ? control(p3, p1, p2, d3, d2) : p2;
  return ["C", ...c1, ...c2, ...p2];
}

/** Curve through points[from..to]; ends leave along their segment so corners stay sharp. */
function fitRun(points, from, to, out) {
  if (to - from === 1) {
    out.push(["L", ...points[to]]);
    return;
  }
  for (let i = from; i < to; i++) {
    const before = i === from ? mirror(points[from], points[from + 1]) : points[i - 1];
    const after = i + 1 === to ? mirror(points[to], points[to - 1]) : points[i + 2];
    out.push(catmullRomSegment(before, points[i], points[i + 1], after));
  }
}

function smoothSubpath(commands) {
  // Hand-drawn curves are already smooth.
  if (commands.some(([op]) => op === "C")) return commands;

  const hasZ = commands.at(-1)[0] === "Z";
  const points = commands
    .filter(([op]) => op === "M" || op === "L")
    .map(([, x, y]) => [x, y])
    .filter((point, i, all) => i === 0 || !same(point, all[i - 1]));

  const closed = hasZ || (points.length > 3 && same(points[0], points.at(-1)));
  if (closed && same(points[0], points.at(-1))) points.pop();
  if (points.length < 3) return commands;

  const n = points.length;
  const at = closed ? (i) => points[((i % n) + n) % n] : (i) => points[i];
  const isCorner = (i) => isCornerAt(at, i);

  if (closed) {
    const corners = points.map((_, i) => i).filter(isCorner);

    if (corners.length === 0) {
      // Smooth loop: neighbours wrap around, so there is no kink where it starts.
      const out = [["M", ...points[0]]];
      for (let i = 0; i < n; i++) {
        out.push(catmullRomSegment(points[(i - 1 + n) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]));
      }
      if (hasZ) out.push(["Z"]);
      return out;
    }

    // Start the loop at a corner and treat it as an open stroke ending at that corner.
    const start = corners[0];
    const rotated = [...points.slice(start), ...points.slice(0, start), points[start]];
    return smoothOpen(rotated, (i) => i === 0 || i === rotated.length - 1 || corners.includes((i + start) % n), hasZ);
  }

  return smoothOpen(points, (i) => i === 0 || i === n - 1 || isCorner(i), false);
}

function smoothOpen(points, isBreak, hasZ) {
  const out = [["M", ...points[0]]];
  let from = 0;
  for (let i = 1; i < points.length; i++) {
    if (isBreak(i)) {
      fitRun(points, from, i, out);
      from = i;
    }
  }
  if (hasZ) out.push(["Z"]);
  return out;
}

/* -------------------------------------------------------------------------
 * Conversion
 * ---------------------------------------------------------------------- */

/** Polyline subpaths -> one routed run per group of touching strokes. */
function routeSubpaths(subpaths, advance, route) {
  const polylines = subpaths.map((commands) => {
    const points = commands.filter(([op]) => op !== "Z").map(([, ...coords]) => coords);
    if (commands.at(-1)[0] === "Z") points.push([...points[0]]);
    return points;
  });
  const { strokes, joinsEntry, joinsExit, stretched } = routeGlyph(polylines, {
    entry: route.entry,
    exit: route.entry ? [advance + route.exit[0], route.exit[1]] : null,
    attachSnap: route.attachSnap,
    stretchExit: route.stretchExit,
  });
  return {
    subpaths: strokes.map((points) => points.map(([x, y], i) => [i ? "L" : "M", x, y])),
    joins: { entry: joinsEntry, exit: joinsExit, stretched },
  };
}

/**
 * `transform` maps each [x, y] in font units, e.g. to slant an override glyph.
 * `route` (with the glyph advance) re-routes the strokes for a joined font.
 * Returns the path data and, for routed glyphs, which joins it reaches.
 */
function convertPath(d, { transform, route, advance } = {}) {
  let subpaths = parsePath(d);
  if (transform) {
    subpaths = subpaths.map((commands) =>
      commands.map(([op, ...coords]) => {
        const mapped = [];
        for (let i = 0; i < coords.length; i += 2) mapped.push(...transform(coords[i], coords[i + 1]));
        return [op, ...mapped];
      }),
    );
  }
  // Hand-drawn curves (rare) are left as drawn.
  const polylineOnly = subpaths.every((commands) => commands.every(([op]) => op !== "C"));
  let joins = null;
  if (route && polylineOnly) ({ subpaths, joins } = routeSubpaths(subpaths, advance, route));
  return { d: serialize(smooth ? subpaths.map(smoothSubpath) : subpaths), joins };
}

/** Single-character glyphs of an SVG font: char -> { advance, d }. */
function readFont(fontId) {
  const svg = readFileSync(join(svgDir, `${fontId}.svg`), "utf8");
  const font = readAttributes(svg.match(/<font\s[^>]*>/)[0]);
  const face = readAttributes(svg.match(/<font-face[\s\S]*?\/>/)[0]);

  const glyphs = new Map();
  for (const [tag] of svg.matchAll(/<glyph\s[^>]*\/>/g)) {
    const glyph = readAttributes(tag);
    if (!glyph.unicode || [...glyph.unicode].length !== 1) continue;
    glyphs.set(glyph.unicode, { advance: Number(glyph["horiz-adv-x"] ?? font["horiz-adv-x"]), d: glyph.d });
  }
  return { font, face, glyphs };
}

function convert(fontId) {
  const { font, face, glyphs: source } = readFont(fontId);

  const override = GLYPH_OVERRIDES[fontId];
  if (override) {
    const replacement = readFont(override.source).glyphs;
    for (const char of override.chars) source.set(char, { ...replacement.get(char), slanted: true });
  }
  const slant = override && ((x, y) => [x + override.shear * (y - override.pivotY), y]);

  const glyphs = {};
  const joined = [];
  const stretched = [];
  for (const [char, { advance, d, slanted }] of source) {
    if (!d) {
      glyphs[char] = [advance];
      continue;
    }
    // Only letters join their neighbours; other glyphs are routed but keep their own ends.
    const routing = ROUTED_FONTS[fontId];
    const route = routing && (/\p{L}/u.test(char) ? routing : { entry: null, exit: [0, 0], stretchExit: 0 });
    const result = convertPath(d, { transform: slanted ? slant : undefined, route, advance });
    glyphs[char] = [advance, result.d];
    if (result.joins?.entry && result.joins?.exit) joined.push(char);
    if (result.joins?.stretched) stretched.push(char);
  }
  if (ROUTED_FONTS[fontId]) {
    console.log(`  joined both sides: ${joined.join("")}`);
    console.log(`  exit stretched: ${stretched.join("")}`);
  }

  const data = {
    id: fontId,
    name: face["font-family"],
    unitsPerEm: Number(face["units-per-em"]),
    ascent: Number(face.ascent),
    descent: Number(face.descent),
    advance: Number(font["horiz-adv-x"]),
    glyphs,
    ...(ROUTED_FONTS[fontId] && { joined: true }),
  };

  writeFileSync(join(OUT_DIR, `${fontId}.json`), JSON.stringify(data));
  console.log(`${fontId}: ${Object.keys(glyphs).length} glyphs${smooth ? ", smoothed" : ""}`);
}

for (const fontId of requested.length ? requested : DEFAULT_FONTS) convert(fontId);
