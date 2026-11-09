import { NextResponse } from "next/server";
import type { ConverterSettings } from "svg-to-gcode";
import { readSvgRequest } from "@/features/export/readSvgRequest";
import { convertSvgToGcode, type GcodeResult } from "@/features/export/svgToGcode";

/**
 * POST /api/export/gcode
 *
 * Body: the SVG document (`Content-Type: image/svg+xml`). SVG user units are
 * read as 96 dpi px and converted to mm.
 *
 * Uses the plotter profile (pen heights, drawing feed) and always applies its pen
 * safety rules: Z moves are G1 at no more than F1000.
 *
 * Optional query parameters override the profile's settings, e.g.
 * `?feedRate=3000&zValue=-15&bedWidth=452&bedHeight=305&quadrant=3`.
 *
 * Returns the G-code as text, with the estimated plot time (seconds) in the
 * `X-Estimated-Time` header.
 */

const NUMERIC_SETTINGS = [
    "feedRate",
    "seekRate",
    "zValue",
    "zOffset",
    "tolerance",
    "minimumArea",
    "xOffset",
    "yOffset",
    "zMoveTime",
] as const;

const POSITIVE_SETTINGS = new Set<string>(["feedRate", "seekRate", "tolerance"]);

function parseSettings(params: URLSearchParams): ConverterSettings | string {
    const settings: ConverterSettings = {};

    for (const key of NUMERIC_SETTINGS) {
        const raw = params.get(key);
        if (raw === null) continue;

        const value = Number(raw);
        if (raw.trim() === "" || !Number.isFinite(value)) return `${key} must be a number.`;
        if (POSITIVE_SETTINGS.has(key) && value <= 0) return `${key} must be greater than 0.`;
        if (key !== "zValue" && key !== "xOffset" && key !== "yOffset" && value < 0) {
            return `${key} must not be negative.`;
        }

        settings[key] = value;
    }

    const quadrant = params.get("quadrant");
    if (quadrant !== null) {
        if (!["1", "2", "3", "4"].includes(quadrant)) return "quadrant must be 1, 2, 3 or 4.";
        settings.quadrant = Number(quadrant) as ConverterSettings["quadrant"];
    }

    const pathPlanning = params.get("pathPlanning");
    if (pathPlanning !== null) {
        if (pathPlanning !== "minimumTravel" && pathPlanning !== "sortByArea") {
            return "pathPlanning must be minimumTravel or sortByArea.";
        }
        settings.pathPlanning = pathPlanning;
    }

    const bedWidth = params.get("bedWidth");
    const bedHeight = params.get("bedHeight");
    if (bedWidth !== null || bedHeight !== null) {
        const width = Number(bedWidth);
        const height = Number(bedHeight);
        if (!(width > 0) || !(height > 0)) {
            return "bedWidth and bedHeight must both be given as positive numbers.";
        }
        settings.bedSize = { width, height };
    }

    return settings;
}

export async function POST(request: Request) {
    const settings = parseSettings(new URL(request.url).searchParams);
    if (typeof settings === "string") {
        return NextResponse.json({ error: settings }, { status: 400 });
    }

    const body = await readSvgRequest(request);
    if (!body.ok) return body.response;

    let result: GcodeResult;

    try {
        result = await convertSvgToGcode(body.svg, settings);
    } catch (error) {
        console.error("G-code conversion failed:", error);
        return NextResponse.json(
            { error: "Unable to convert the SVG to G-code." },
            { status: 422 },
        );
    }

    return new Response(result.gcode, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": 'attachment; filename="plotter-export.gcode"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Estimated-Time": result.time.toFixed(1),
        },
    });
}
