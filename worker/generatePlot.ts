import fs from "node:fs";
import path from "node:path";
import { generateClockSvg } from "./generateClockSvg";

const WIDTH = 690;
const HEIGHT = 290;

function escapeXml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function wrapQuote(quote: string, maxLength = 38) {
    const words = quote.split(/\s+/);
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;

        if (candidate.length > maxLength && line) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }

    if (line) lines.push(line);

    return lines;
}

export function generatePlotSvg(
    jobId: number,
    quote: string,
    date: Date,
    timezone = "Asia/Kolkata",
) {
    const lines = wrapQuote(quote);

    const quoteSvg = lines
        .map(
            (line, index) => `
                <text
                x="430"
                y="${145 + (index - (lines.length - 1) / 2) * 22}"
                text-anchor="middle"
                font-family="serif"
                font-size="14"
                fill="#111111"
                >${escapeXml(line)}</text>
            `,
        )
        .join("");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="${WIDTH}mm"
            height="${HEIGHT}mm"
            viewBox="0 0 ${WIDTH} ${HEIGHT}"
        >
            ${generateClockSvg(date, timezone)}
            <g id="quote">
                ${quoteSvg}
            </g>
        </svg>`;

    const outputDirectory = path.resolve(process.cwd(), "data", "plots");

    fs.mkdirSync(outputDirectory, { recursive: true });

    const outputPath = path.join(outputDirectory, `job-${jobId}.svg`);

    fs.writeFileSync(outputPath, svg, "utf8");

    return outputPath;
}