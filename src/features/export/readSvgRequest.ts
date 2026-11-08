import { NextResponse } from "next/server";

export const MAX_SVG_SIZE = 10 * 1024 * 1024; // 10 MB

export type SvgRequestResult =
    | { ok: true; svg: string }
    | { ok: false; response: NextResponse };

function fail(error: string, status: number): SvgRequestResult {
    return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Reads and validates an `image/svg+xml` request body (shared by the
 * /api/export/* routes). Returns the SVG text or a ready-made error response.
 */
export async function readSvgRequest(request: Request): Promise<SvgRequestResult> {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("image/svg+xml")) {
        return fail("Content-Type must be image/svg+xml.", 415);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > MAX_SVG_SIZE) {
        return fail("SVG exceeds the 10 MB limit.", 413);
    }

    let svg: string;

    try {
        svg = await request.text();
    } catch {
        return fail("Unable to read SVG request body.", 400);
    }

    const actualSize = new TextEncoder().encode(svg).byteLength;

    if (actualSize === 0 || actualSize > MAX_SVG_SIZE) {
        return fail("SVG is empty or exceeds the 10 MB limit.", 413);
    }

    const isSvg = /<svg(?:\s|>)/i.test(svg) && /<\/svg>\s*$/i.test(svg.trim());

    if (!isSvg) {
        return fail("Invalid SVG document.", 400);
    }

    return { ok: true, svg };
}
