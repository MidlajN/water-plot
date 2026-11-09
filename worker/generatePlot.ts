import fs from "node:fs";
import path from "node:path";

import { getSingleLineFont } from "../src/features/workspace/text/fonts";
import { GlyphPathWriter, measureText } from "../src/features/workspace/text/singleLinePath";
import { generateClockSvg } from "./generateClockSvg";

const WIDTH = 690;
const HEIGHT = 290;

/** The quote is drawn in the script font: one pen-down per word, plus its dots and bars. */
const QUOTE_FONT = getSingleLineFont("HersheyScript1");

/** Area to the right of the clock the quote must fit in (viewBox units, i.e. mm). */
const QUOTE_BOX = { left: 190, right: 670, top: 20, bottom: 270 };

const MAX_FONT_SIZE = 18;
const MIN_FONT_SIZE = 8;
const LINE_HEIGHT = 1.4;

/** Greedy word wrap by measured width. */
function wrapQuote(quote: string, fontSize: number, maxWidth: number) {
    const lines: string[] = [];
    let line = "";

    for (const word of quote.trim().split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;

        if (line && measureText(QUOTE_FONT, candidate, fontSize) > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }

    if (line) lines.push(line);
    return lines;
}

/**
 * Single-line path data for the quote, centred in QUOTE_BOX. The size starts at
 * MAX_FONT_SIZE and shrinks until the wrapped lines fit the box.
 */
export function layoutQuote(quote: string) {
    const boxWidth = QUOTE_BOX.right - QUOTE_BOX.left;
    const boxHeight = QUOTE_BOX.bottom - QUOTE_BOX.top;
    const centreX = (QUOTE_BOX.left + QUOTE_BOX.right) / 2;
    const centreY = (QUOTE_BOX.top + QUOTE_BOX.bottom) / 2;

    let fontSize = MAX_FONT_SIZE;
    let lines = wrapQuote(quote, fontSize, boxWidth);
    while (fontSize > MIN_FONT_SIZE && lines.length * fontSize * LINE_HEIGHT > boxHeight) {
        fontSize = Math.max(MIN_FONT_SIZE, fontSize * 0.9);
        lines = wrapQuote(quote, fontSize, boxWidth);
    }

    const scale = fontSize / QUOTE_FONT.unitsPerEm;
    const lineHeight = fontSize * LINE_HEIGHT;
    // Puts the middle of the ascent-descent band on each line's centre.
    const baselineOffset = ((QUOTE_FONT.ascent + QUOTE_FONT.descent) / 2) * scale;
    const writer = new GlyphPathWriter(QUOTE_FONT, fontSize);

    lines.forEach((line, index) => {
        const lineCentre = centreY + (index - (lines.length - 1) / 2) * lineHeight;
        const x = centreX - measureText(QUOTE_FONT, line, fontSize) / 2;
        writer.addLine(line, x, lineCentre + baselineOffset);
    });

    return { d: writer.finish(), fontSize, lines };
}

export function generatePlotSvg(
    jobId: number,
    quote: string,
    date: Date,
    timezone = "Asia/Kolkata",
) {
    const { d } = layoutQuote(quote);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="${WIDTH}mm"
            height="${HEIGHT}mm"
            viewBox="0 0 ${WIDTH} ${HEIGHT}"
        >
            ${generateClockSvg(date, timezone)}
            <path
                id="quote"
                d="${d}"
                fill="none"
                stroke="#111111"
                stroke-width="0.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>`;

    const outputDirectory = path.resolve(process.cwd(), "data", "plots");

    fs.mkdirSync(outputDirectory, { recursive: true });

    const outputPath = path.join(outputDirectory, `job-${jobId}.svg`);

    fs.writeFileSync(outputPath, svg, "utf8");

    return outputPath;
}
