import { NextResponse, connection, type NextRequest } from "next/server";

import { deleteUpload, readUpload } from "@/features/uploads/store";

/** GET /api/uploads/:id: the upload's line art. An id's file never changes, so it caches for good. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/uploads/[id]">) {
    await connection();
    const { id } = await ctx.params;
    const svg = await readUpload(id);

    if (svg === null) {
        return NextResponse.json({ error: "Upload not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        },
    });
}

/** DELETE /api/uploads/:id: removes the upload. Already-gone ids succeed too. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/uploads/[id]">) {
    const { id } = await ctx.params;
    deleteUpload(id);
    return new Response(null, { status: 204 });
}
