import { NextResponse, connection } from "next/server";

import { startJob } from "@/features/plotter/gateway/client";
import { NO_STORE, gatewayErrorResponse, jsonError, readJsonObject } from "@/features/plotter/gateway/respond";

/** POST /api/plotter/jobs/start { jobId }: starts streaming an uploaded job. */
export async function POST(request: Request) {
    await connection();

    const body = await readJsonObject(request);
    const jobId = body?.jobId;
    if (typeof jobId !== "string" || !jobId) return jsonError("jobId is required.", 400);

    try {
        return NextResponse.json(await startJob(jobId), { headers: NO_STORE });
    } catch (error) {
        return gatewayErrorResponse(error);
    }
}
