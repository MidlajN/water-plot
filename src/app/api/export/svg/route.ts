import { readSvgRequest } from "@/features/export/readSvgRequest";

export async function POST(request: Request) {
    const body = await readSvgRequest(request);
    if (!body.ok) return body.response;

    // For this testing endpoint, return the SVG unchanged.
    return new Response(body.svg, {
        status: 200,
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Content-Disposition": 'inline; filename="plotter-export.svg"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:",
        },
    });
}
