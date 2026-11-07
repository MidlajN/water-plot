#!/usr/bin/env node
/**
 * Converts SVG single-line (stroke) fonts into the compact JSON files used by
 * src/features/workspace/text/fonts.
 *
 * Usage:
 *   node scripts/build-single-line-fonts.mjs <svg-font-dir> [FontId ...]
 *
 * The EMSL Hershey SVG fonts ship in the `hersheytext` npm package:
 *   npm pack hersheytext && tar xzf hersheytext-*.tgz
 *   node scripts/build-single-line-fonts.mjs package/svg_fonts HersheySans1 HersheyScript1
 *
 * After adding a font, register it in src/features/workspace/text/fonts/index.ts
 * and make sure its license is covered in fonts/LICENSE.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT_DIR = resolve(import.meta.dirname, "../src/features/workspace/text/fonts/data");
const DEFAULT_FONTS = ["HersheySans1", "HersheySansMed", "HersheySerifMed", "HersheyScript1"];

const [svgDir, ...requested] = process.argv.slice(2);

if (!svgDir) {
  console.error("Usage: node scripts/build-single-line-fonts.mjs <svg-font-dir> [FontId ...]");
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

const round = (value) => String(Math.round(value * 10) / 10);

/** Re-emit path data with rounded numbers; the fonts only use absolute M/L/C/Z. */
function compactPath(d) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const unsupported = tokens.find((token) => /^[a-zA-Z]$/.test(token) && !"MLCZ".includes(token));
  if (unsupported) throw new Error(`Unsupported path command "${unsupported}" in: ${d}`);

  return tokens.map((token) => (/^[a-zA-Z]$/.test(token) ? token : round(Number(token)))).join(" ");
}

function convert(fontId) {
  const svg = readFileSync(join(svgDir, `${fontId}.svg`), "utf8");
  const font = readAttributes(svg.match(/<font\s[^>]*>/)[0]);
  const face = readAttributes(svg.match(/<font-face[\s\S]*?\/>/)[0]);

  const glyphs = {};
  for (const [tag] of svg.matchAll(/<glyph\s[^>]*\/>/g)) {
    const glyph = readAttributes(tag);
    if (!glyph.unicode || [...glyph.unicode].length !== 1) continue;
    const advance = Number(glyph["horiz-adv-x"] ?? font["horiz-adv-x"]);
    glyphs[glyph.unicode] = glyph.d ? [advance, compactPath(glyph.d)] : [advance];
  }

  const data = {
    id: fontId,
    name: face["font-family"],
    unitsPerEm: Number(face["units-per-em"]),
    ascent: Number(face.ascent),
    descent: Number(face.descent),
    advance: Number(font["horiz-adv-x"]),
    glyphs,
  };

  writeFileSync(join(OUT_DIR, `${fontId}.json`), JSON.stringify(data));
  console.log(`${fontId}: ${Object.keys(glyphs).length} glyphs`);
}

for (const fontId of requested.length ? requested : DEFAULT_FONTS) convert(fontId);
