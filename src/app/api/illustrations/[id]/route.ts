import { NextResponse, type NextRequest } from "next/server";
import { readIllustration } from "@/features/illustrations/library";

/** GET /api/illustrations/:id: the illustration's SVG. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/illustrations/[id]">) {
    const { id } = await ctx.params;
    const svg = await readIllustration(id);

    if (svg === null) {
        return NextResponse.json({ error: "Illustration not found." }, { status: 404 });
    }

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        },
    });
}
