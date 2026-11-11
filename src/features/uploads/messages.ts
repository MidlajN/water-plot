/**
 * Upload limits and wording shared by the server route and the Elements pickers
 * (no server-only imports, so the browser can check files before sending them).
 */

import type { UploadNote, UploadSanitizeResult } from "../ai/sanitizeSvg";

export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const UPLOAD_MAX_LABEL = "2 MB";

/** What was left out of a saved upload, as one short sentence each. */
export const UPLOAD_NOTE_TEXT: Record<UploadNote, string> = {
    text: "Text was left out. Convert it to outlines to keep it.",
    images: "Pictures were left out; only lines can be plotted.",
    links: "Linked symbols were left out.",
    skipped: "A few parts couldn't be read and were left out.",
};

/** Why an upload couldn't be used, naming the file. */
export function uploadFailureMessage(name: string, result: Extract<UploadSanitizeResult, { ok: false }>): string {
    const file = `“${name}”`;
    switch (result.code) {
        case "too_large":
            return `${file} is larger than ${UPLOAD_MAX_LABEL}.`;
        case "too_complex":
            return `${file} has too many shapes to plot. Simplify it and try again.`;
        case "too_deep":
            return `${file} is nested too deeply. Ungroup it and try again.`;
        case "empty":
            if (result.notes.includes("text")) return `${file} only has text. Convert the text to outlines and upload it again.`;
            if (result.notes.includes("images")) return `${file} only holds a picture, not lines. Upload a vector drawing instead.`;
            return `${file} has nothing to draw.`;
        default:
            return `${file} isn't an SVG drawing that can be read.`;
    }
}
