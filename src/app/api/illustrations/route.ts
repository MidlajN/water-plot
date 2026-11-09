import { NextResponse } from "next/server";
import { listIllustrations } from "@/features/illustrations/library";

/** GET /api/illustrations: the illustration catalog ({ id, name, category }[]). */
export async function GET() {
    return NextResponse.json(
        { illustrations: await listIllustrations() },
        { headers: { "Cache-Control": "public, max-age=300" } },
    );
}
