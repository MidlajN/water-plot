import { NextResponse, connection } from "next/server";

import { listPlotJobs } from "@/features/auto/jobs";

/** GET /api/auto/jobs?limit=20: recent Auto mode plots, newest first. */
export async function GET(request: Request) {
    await connection();

    const requested = Number(new URL(request.url).searchParams.get("limit") ?? 20);
    const limit = Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 20;

    return NextResponse.json({ jobs: listPlotJobs(limit) }, { headers: { "Cache-Control": "no-store" } });
}
