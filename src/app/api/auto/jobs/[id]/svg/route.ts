import { NextResponse, connection } from "next/server";

import { readPlotJobSvg } from "@/features/auto/jobs";

/** GET /api/auto/jobs/:id/svg: the plot generated for an Auto mode job. */
export async function GET(_request: Request, ctx: RouteContext<"/api/auto/jobs/[id]/svg">) {
    await connection();

    const id = Number((await ctx.params).id);
    const svg = Number.isInteger(id) && id > 0 ? await readPlotJobSvg(id) : null;
    if (svg === null) return NextResponse.json({ error: "Plot not found." }, { status: 404 });

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:",
        },
    });
}
