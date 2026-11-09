import fs from "node:fs";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "../src/lib/db";
import { plotJobs } from "../src/lib/db/schema";
import { convertSvgToGcode } from "../src/features/export/svgToGcode";
import { getStatus, startJob, uploadJob } from "../src/features/plotter/gateway/client";
import { gatewayConnection } from "../src/features/plotter/gateway/connection";
import { isMachineBusy, type JobComplete } from "../src/features/plotter/gateway/types";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function updateJob(jobId: number, values: Partial<typeof plotJobs.$inferInsert>) {
    db.update(plotJobs).set(values).where(eq(plotJobs.id, jobId)).run();
}

/**
 * Sends a generated plot to the plotter: SVG → plotter-safe G-code → upload → start.
 * A busy or unreachable plotter skips the job (a clock plot is stale a minute later).
 */
export async function sendPlotJob(jobId: number, svgPath: string) {
    try {
        const status = await getStatus().catch((error) => {
            throw new Error(`Plotter unreachable: ${errorMessage(error)}`, { cause: error });
        });
        if (isMachineBusy(status)) {
            updateJob(jobId, { status: "skipped", error: `Plotter busy (${status.state}).` });
            console.log(`[Auto] Plotter busy (${status.state}); skipped job #${jobId}.`);
            return;
        }

        const { gcode, lines } = await convertSvgToGcode(fs.readFileSync(svgPath, "utf8"));
        const upload = await uploadJob(`auto-job-${jobId}`, gcode);
        await startJob(upload.job_id);

        updateJob(jobId, { status: "running", startedAt: new Date().toISOString(), gatewayJobId: upload.job_id });
        console.log(`[Auto] Job #${jobId} plotting as ${upload.job_id} (${lines} lines).`);
    } catch (error) {
        const message = errorMessage(error);
        const unreachable = message.startsWith("Plotter unreachable");
        updateJob(jobId, { status: unreachable ? "skipped" : "failed", error: message });
        console.error(`[Auto] Couldn't plot job #${jobId}: ${message}`);
    }
}

function completeJob(result: JobComplete) {
    const job = db.select({ id: plotJobs.id }).from(plotJobs).where(eq(plotJobs.gatewayJobId, result.job_id)).get();
    if (!job) return;

    const success = result.status === "success";
    updateJob(job.id, {
        status: success ? "completed" : "failed",
        error: success ? null : `Plot ${result.status}.`,
        completedAt: new Date().toISOString(),
    });
    console.log(`[Auto] Job #${job.id} ${success ? "completed" : result.status} in ${result.duration_seconds}s.`);
}

/** Running jobs the gateway no longer knows about (worker or gateway restarted) failed. */
async function reconcileRunningJobs() {
    const running = db
        .select({ id: plotJobs.id, gatewayJobId: plotJobs.gatewayJobId })
        .from(plotJobs)
        .where(and(eq(plotJobs.status, "running"), isNotNull(plotJobs.gatewayJobId)))
        .all();
    if (running.length === 0) return;

    let activeJobId: string | undefined;
    try {
        const status = await getStatus();
        activeJobId = isMachineBusy(status) ? status.job?.job_id : undefined;
    } catch {
        return; // Can't tell yet; try again when the gateway is back.
    }

    for (const job of running) {
        if (job.gatewayJobId === activeJobId) continue;
        updateJob(job.id, { status: "failed", error: "Interrupted: the plotter lost track of this job." });
        console.warn(`[Auto] Job #${job.id} was interrupted.`);
    }
}

/** Follows the gateway's events to finish running jobs. */
export function startPlotTracking() {
    gatewayConnection().subscribe((event) => {
        if (event.type === "job_complete") completeJob(event.data);
        else if (event.type === "link") {
            console.log(`[Auto] Plotter ${event.data.connected ? "connected" : "disconnected"}.`);
            if (event.data.connected) void reconcileRunningJobs();
        }
    });
}
