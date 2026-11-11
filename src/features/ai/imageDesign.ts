import "server-only";

import { getAiArea } from "./config";
import { ENGINE_LABELS, type ImageEngine } from "./constants";
import { getImageEngineConfig } from "./images/config";
import { openAiImage } from "./images/openai";
import { pollinationsImage } from "./images/pollinations";
import { lineArtPrompt, titleFromIdea } from "./images/prompt";
import { DesignError } from "./providers/shared";
import { sanitizeSvg } from "./sanitizeSvg";
import type { DesignRequest, DesignResponse } from "./schema";
import { TraceError, traceCenterlines } from "./trace/centerline";
import { ImageDecodeError, decodeToGray, downscale, sniffImage } from "./trace/decode";

/** Traced at most this many pixels on the long side (the image engines send 1024 px). */
const TRACE_SIDE = 1024;

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/**
 * A line-art design from an image engine: the idea (plus any refinement) becomes a
 * line-art image prompt, the image is traced into centerline strokes, and the SVG goes
 * through the same sanitizer as the language-model designs. Image engines make line art
 * only; text designs stay with the vector engine.
 */
export async function createImageDesign(request: DesignRequest, engine: ImageEngine): Promise<Extract<DesignResponse, { status: "success" }>> {
    const name = ENGINE_LABELS[engine];
    const config = getImageEngineConfig(engine);
    if (!config) throw new DesignError(`${name} isn't set up on this server.`, 503);
    const area = getAiArea();

    const started = Date.now();
    const prompt = lineArtPrompt(request.prompt, request.mode === "refine" ? request.refinement : undefined);
    const bytes = config.engine === "flux" ? await pollinationsImage(config, prompt) : await openAiImage(config, prompt);
    const fetched = Date.now();

    let traced;
    try {
        traced = traceCenterlines(downscale(decodeToGray(bytes), TRACE_SIDE));
    } catch (error) {
        if (error instanceof ImageDecodeError) {
            console.warn(`[AI] ${name} image (${sniffImage(bytes)}, ${kb(bytes.byteLength)}) couldn't be read: ${error.message}`);
            throw new DesignError(`${name} sent an image that couldn't be read. Try again.`, 502);
        }
        if (error instanceof TraceError) {
            console.warn(`[AI] ${name} image had nothing to trace: ${error.message}`);
            throw new DesignError("The image had no clear lines to draw. Try again or rephrase the idea.", 502);
        }
        throw error;
    }

    const sanitized = sanitizeSvg(traced.svg, area, null);
    if (!sanitized.ok) {
        console.warn(`[AI] Traced ${name} drawing rejected (${sanitized.reasons.join("; ")})`);
        throw new DesignError("The drawing couldn't be made plotter-safe. Try again or simplify the idea.", 502);
    }

    console.info(
        `[AI] ${name} ${config.model}: ${sniffImage(bytes)} ${kb(bytes.byteLength)} in ${((fetched - started) / 1000).toFixed(1)} s, ` +
            `traced to ${traced.strokes} strokes (${traced.pathChars} chars, line ≈ ${traced.lineWidth.toFixed(1)} px) in ${Date.now() - fetched} ms`,
    );

    return {
        status: "success",
        design: {
            title: titleFromIdea(request.prompt),
            description: `Line drawing traced from a ${name} image.`,
            category: "line_art",
            text: null,
            illustration: { svg: sanitized.svg, box: sanitized.box },
            layout: { width: area.width, height: area.height, unit: "mm" },
        },
        sources: [],
        usedWebSearch: false,
        engine,
    };
}
