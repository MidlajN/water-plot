import { NextResponse } from "next/server";

export const MAX_SVG_SIZE = 10 * 1024 * 1024; // 10 MB

export type SvgRequestResult =
    | { ok: true; svg: string }
    | { ok: false; response: NextResponse };

function fail(error: string, status: number): SvgRequestResult {
    return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/** The body as text, stopping as soon as it passes `maxBytes` (route handlers have no limit of their own). */
async function readCapped(request: Request, maxBytes: number): Promise<string | "too_large" | "unreadable"> {
    if (!request.body) return "";
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                return "too_large";
            }
            chunks.push(value);
        }
    } catch {
        return "unreadable";
    }

    return Buffer.concat(chunks).toString("utf8");
}

/**
 * Reads and validates an `image/svg+xml` request body (shared by the /api/export/*,
 * /api/plotter/jobs and /api/uploads routes). Returns the SVG text or a ready-made
 * error response. `maxBytes` defaults to 10 MB.
 */
export async function readSvgRequest(request: Request, { maxBytes = MAX_SVG_SIZE }: { maxBytes?: number } = {}): Promise<SvgRequestResult> {
    const limit = `${+(maxBytes / (1024 * 1024)).toFixed(1)} MB`;
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("image/svg+xml")) {
        return fail("Content-Type must be image/svg+xml.", 415);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > maxBytes) {
        return fail(`SVG exceeds the ${limit} limit.`, 413);
    }

    const svg = await readCapped(request, maxBytes);

    if (svg === "unreadable") {
        return fail("Unable to read SVG request body.", 400);
    }

    if (svg === "too_large" || svg.length === 0) {
        return fail(`SVG is empty or exceeds the ${limit} limit.`, 413);
    }

    const isSvg = /<svg(?:\s|>)/i.test(svg) && /<\/svg>\s*$/i.test(svg.trim());

    if (!isSvg) {
        return fail("Invalid SVG document.", 400);
    }

    return { ok: true, svg };
}
