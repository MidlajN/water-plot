import { Converter, type ConverterSettings } from "svg-to-gcode";

import {
    PAGE_WIDTH_MM,
    PLOTTER_PROFILE,
    appendPark,
    applyPenSafety,
    mirrorGcodeX,
    plotterConverterSettings,
    plotterMirror,
    plotterParkPosition,
} from "../plotter/profile";
import {
    describeStats,
    optimizeGcode,
    penStartPoint,
    plotterBridgeMm,
    plotterOptimize,
    type OptimizeStats,
} from "./pathOptimizer";

export interface GcodeResult {
    gcode: string;
    /** Estimated plotting time in seconds. */
    time: number;
    /** Number of G-code lines (what the gateway streams). */
    lines: number;
    /** What the pen-path optimiser did, when it ran. */
    optimization?: OptimizeStats;
}

export interface GcodeOptions {
    /**
     * The G-code is going to the plotter, so it's mirrored when PLOTTER_MIRROR is on.
     * Leave it off for downloads: they stay as drawn.
     */
    forPlotter?: boolean;
}

/** svg-to-gcode reads SVG user units as 96 dpi px. */
const PX_TO_MM = 25.4 / 96;

const leftOfOrigin = (settings: ConverterSettings) => settings.quadrant === 2 || settings.quadrant === 3;

/**
 * G-code X of the page's vertical centre line, using svg-to-gcode's own mapping:
 * X = (x, less the width in quadrants 2 and 3) in mm + xOffset. Falls back to the
 * standard page when the SVG has no viewBox.
 */
function svgMirrorAxis(svg: string, settings: ConverterSettings) {
    const viewBox = svg.match(/<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
    const [minX, , width] = viewBox ?? [];
    if (viewBox?.length !== 4 || !Number.isFinite(minX) || !(width > 0)) return pageMirrorAxis(settings);

    const centre = leftOfOrigin(settings) ? minX - width / 2 : minX + width / 2;
    return centre * PX_TO_MM + (settings.xOffset ?? 0);
}

/** G-code X of the standard page's centre line, for G-code that carries no page size. */
function pageMirrorAxis(settings: ConverterSettings) {
    const half = PAGE_WIDTH_MM / 2;
    return (leftOfOrigin(settings) ? -half : half) + (settings.xOffset ?? 0);
}

/** Pen-safety limits for the given converter settings. */
function safetyFor(settings: ConverterSettings) {
    const zDraw = settings.zValue ?? PLOTTER_PROFILE.zDraw;
    const zOffset = settings.zOffset ?? 0;
    // Mirrors svg-to-gcode's own pen-up rule.
    const zTravel = zDraw < 0 ? zDraw + zOffset : zDraw - zOffset;

    return {
        zTravel,
        zMin: Math.min(zDraw, zTravel),
        zMax: Math.max(zDraw, zTravel),
        zFeedMax: PLOTTER_PROFILE.zFeedMax,
        feedRate: settings.feedRate ?? PLOTTER_PROFILE.feedRate,
    };
}

export function countLines(gcode: string) {
    return gcode.split("\n").filter((line) => line.trim()).length;
}

/**
 * Pen safety, the left–right mirror when `mirrorAxis` is given, then the park move
 * (pen up first). The park position isn't mirrored: it's a place on the machine.
 */
function finish(gcode: string, settings: ConverterSettings, mirrorAxis: number | null) {
    const safety = safetyFor(settings);
    const safe = applyPenSafety(gcode, safety);
    const placed = mirrorAxis === null ? safe : mirrorGcodeX(safe, mirrorAxis);
    return appendPark(placed, plotterParkPosition(), safety.zTravel, safety.zFeedMax);
}

/**
 * Converts an SVG (user units read as 96 dpi px) to plotter-safe G-code using the
 * plotter profile, with optional setting overrides. Strokes are reordered for less
 * pen-up travel, with gaps up to PLOTTER_BRIDGE_MM drawn pen-down (see pathOptimizer;
 * PLOTTER_OPTIMIZE=false turns it off). The program ends with the pen parked (see
 * plotterParkPosition). With `forPlotter` and PLOTTER_MIRROR on, the page is mirrored
 * left–right.
 */
export async function convertSvgToGcode(
    svg: string,
    overrides: ConverterSettings = {},
    { forPlotter = false }: GcodeOptions = {},
): Promise<GcodeResult> {
    const settings = { ...plotterConverterSettings(), ...overrides };
    const result = await new Converter(settings).convert(svg);
    const mirrorAxis = forPlotter && plotterMirror() ? svgMirrorAxis(svg, settings) : null;

    let raw = result.gcode;
    let time = result.time;
    let optimization: OptimizeStats | undefined;
    if (plotterOptimize()) {
        const bridgeMm = plotterBridgeMm();
        // Optimised before finish(), so the start point is mapped into pre-mirror space.
        const optimized = optimizeGcode(raw, { settings, bridgeMm, start: penStartPoint(plotterParkPosition(), mirrorAxis) });
        if (optimized.optimized) {
            ({ gcode: raw, time } = optimized);
            optimization = optimized.stats;
            console.info(describeStats(optimized.stats, bridgeMm));
        } else {
            console.info(`[pathOptimizer] skipped: ${optimized.reason}`);
        }
    }

    const gcode = finish(raw, settings, mirrorAxis);
    return { gcode, time, lines: countLines(gcode), optimization };
}

/**
 * Makes G-code from elsewhere (an uploaded file) plotter-safe with the profile's limits,
 * and parks at the end. With `forPlotter` and PLOTTER_MIRROR on, it's mirrored left–right
 * across the standard page.
 */
export function makeGcodeSafe(gcode: string, { forPlotter = false }: GcodeOptions = {}) {
    const settings = plotterConverterSettings();
    const mirrorAxis = forPlotter && plotterMirror() ? pageMirrorAxis(settings) : null;
    const safe = finish(gcode, settings, mirrorAxis);
    return { gcode: safe, lines: countLines(safe) };
}
