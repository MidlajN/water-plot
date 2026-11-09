import { NextResponse, connection } from "next/server";

import { MAX_SVG_SIZE, readSvgRequest } from "@/features/export/readSvgRequest";
import { convertSvgToGcode, makeGcodeSafe } from "@/features/export/svgToGcode";
import { getStatus, startJob, uploadJob } from "@/features/plotter/gateway/client";
import { NO_STORE, gatewayErrorResponse, jsonError } from "@/features/plotter/gateway/respond";
import { isMachineBusy } from "@/features/plotter/gateway/types";

/**
 * POST /api/plotter/jobs?start=1&name=…
 *
 * Sends a drawing to the plotter. The body is either the page SVG
 * (`image/svg+xml`, converted with the plotter profile) or ready G-code
 * (`text/plain`, made plotter-safe). With `start=1` the job starts right away.
 *
 * Returns { jobId, linesCount, status, estimatedSeconds }; 409 if the plotter is busy.
 */
export async function POST(request: Request) {
    await connection();

    const params = new URL(request.url).searchParams;
    const name = (params.get("name") ?? "").trim().slice(0, 100) || `plot-${Date.now()}`;
    const start = params.get("start") === "1";
    const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

    let gcode: string;
    let estimatedSeconds: number | null = null;

    if (contentType.includes("image/svg+xml")) {
        const body = await readSvgRequest(request);
        if (!body.ok) return body.response;
        try {
            const result = await convertSvgToGcode(body.svg);
            gcode = result.gcode;
            estimatedSeconds = Math.round(result.time);
        } catch (error) {
            console.error("G-code conversion failed:", error);
            return jsonError("Unable to convert the drawing to G-code.", 422);
        }
    } else if (contentType.includes("text/plain")) {
        const text = await request.text().catch(() => "");
        if (!text.trim()) return jsonError("G-code is empty.", 400);
        if (new TextEncoder().encode(text).byteLength > MAX_SVG_SIZE) return jsonError("G-code exceeds the 10 MB limit.", 413);
        gcode = makeGcodeSafe(text).gcode;
    } else {
        return jsonError("Content-Type must be image/svg+xml or text/plain.", 415);
    }

    if (!gcode.trim()) return jsonError("Nothing to plot.", 422);

    try {
        if (isMachineBusy(await getStatus())) return jsonError("The plotter is busy.", 409);

        const upload = await uploadJob(name, gcode);
        const status = start ? (await startJob(upload.job_id)).status : upload.status;

        return NextResponse.json(
            { jobId: upload.job_id, linesCount: upload.lines_count, status, estimatedSeconds },
            { headers: NO_STORE },
        );
    } catch (error) {
        return gatewayErrorResponse(error);
    }
}
