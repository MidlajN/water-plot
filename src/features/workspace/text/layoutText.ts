import type { SingleLineFont } from "./fonts";
import { GlyphPathWriter, measureText } from "./singleLinePath";

export interface TextBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LaidOutLine {
    text: string;
    /** Left edge of the line. */
    x: number;
    baseline: number;
    width: number;
}

export interface TextLayout {
    fontSize: number;
    lineHeight: number;
    lines: LaidOutLine[];
    /** Single-line path data for every line, in the box's coordinates. */
    d: string;
}

const LINE_HEIGHT = 1.4;

/** Greedy word wrap of one line by measured width. */
function wrap(font: SingleLineFont, text: string, fontSize: number, maxWidth: number): string[] {
    const out: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && measureText(font, candidate, fontSize) > maxWidth) {
            out.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) out.push(line);
    return out;
}

/**
 * Fits lines of single-line text inside a box, centred horizontally and vertically.
 * The font size starts at `maxFontSize` and shrinks until every line fits; lines that
 * still don't fit at `minFontSize` are wrapped at word boundaries. Units are whatever
 * the box uses (mm for plotter designs).
 */
export function layoutTextInBox(
    font: SingleLineFont,
    lines: string[],
    box: TextBox,
    { maxFontSize = 24, minFontSize = 4 }: { maxFontSize?: number; minFontSize?: number } = {},
): TextLayout {
    const source = lines.map((line) => line.trim()).filter(Boolean);
    let fontSize = Math.min(maxFontSize, box.height / Math.max(1, source.length * LINE_HEIGHT));
    let rows = source;

    const fits = (size: number, candidate: string[]) =>
        candidate.length * size * LINE_HEIGHT <= box.height + 1e-6 &&
        candidate.every((row) => measureText(font, row, size) <= box.width + 1e-6);

    while (fontSize > minFontSize && !fits(fontSize, rows)) {
        fontSize = Math.max(minFontSize, fontSize * 0.92);
    }
    if (!fits(fontSize, rows)) {
        rows = source.flatMap((line) => wrap(font, line, fontSize, box.width));
        while (fontSize > minFontSize && rows.length * fontSize * LINE_HEIGHT > box.height) {
            fontSize = Math.max(minFontSize, fontSize * 0.92);
            rows = source.flatMap((line) => wrap(font, line, fontSize, box.width));
        }
    }

    const scale = fontSize / font.unitsPerEm;
    const lineHeight = fontSize * LINE_HEIGHT;
    // Puts the middle of the ascent-descent band on each row's centre.
    const baselineOffset = ((font.ascent + font.descent) / 2) * scale;
    const centreX = box.x + box.width / 2;
    const centreY = box.y + box.height / 2;
    const writer = new GlyphPathWriter(font, fontSize);

    const laidOut = rows.map((text, index) => {
        const width = measureText(font, text, fontSize);
        const x = centreX - width / 2;
        const baseline = centreY + (index - (rows.length - 1) / 2) * lineHeight + baselineOffset;
        writer.addLine(text, x, baseline);
        return { text, x, baseline, width };
    });

    return { fontSize, lineHeight, lines: laidOut, d: writer.finish() };
}
