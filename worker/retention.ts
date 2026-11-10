import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, inArray, lt, notInArray } from "drizzle-orm";

import { db } from "../src/lib/db";
import { plotJobs } from "../src/lib/db/schema";

/** How many Auto mode jobs (and their SVG files) are kept. */
export const KEEP_JOBS = 100;

const PLOTS_DIRECTORY = path.resolve(process.cwd(), "data", "plots");
const JOB_FILE = /^job-(\d+)\.svg$/;

/**
 * Keeps only the newest KEEP_JOBS jobs: older rows are deleted, and so is every
 * generated SVG in data/plots that no kept job owns (including files left behind by
 * older versions). Only files named job-<id>.svg in that folder are touched.
 */
export function pruneOldJobs(keep = KEEP_JOBS) {
    const kept = db
        .select({ id: plotJobs.id })
        .from(plotJobs)
        .orderBy(desc(plotJobs.id))
        .limit(keep)
        .all()
        .map((job) => job.id);

    const removed = kept.length
        ? db.delete(plotJobs).where(notInArray(plotJobs.id, kept)).run().changes
        : db.delete(plotJobs).run().changes;

    const keptIds = new Set(kept);
    let files = 0;
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(PLOTS_DIRECTORY);
    } catch {
        // No plots folder yet.
    }
    for (const name of entries) {
        const match = JOB_FILE.exec(name);
        if (!match || keptIds.has(Number(match[1]))) continue;
        try {
            fs.unlinkSync(path.join(PLOTS_DIRECTORY, name));
            files++;
        } catch (error) {
            console.warn(`[Auto] Couldn't delete ${name}:`, error instanceof Error ? error.message : error);
        }
    }

    if (removed || files) console.log(`[Auto] Pruned ${removed} old job(s) and ${files} SVG file(s); keeping the newest ${keep}.`);
}

/**
 * A job stays "pending" only for the second or two between being created and sent, so
 * pending jobs older than that were interrupted (the worker stopped or crashed). Marks
 * them skipped so they don't show as pending forever.
 */
export function skipInterruptedJobs(now = Date.now()) {
    const cutoff = new Date(now - 2 * 60_000).toISOString();
    const stale = db
        .select({ id: plotJobs.id })
        .from(plotJobs)
        .where(and(eq(plotJobs.status, "pending"), lt(plotJobs.scheduledAt, cutoff)))
        .all()
        .map((job) => job.id);
    if (!stale.length) return;

    db.update(plotJobs)
        .set({ status: "skipped", error: "Interrupted before it was sent (the worker stopped)." })
        .where(inArray(plotJobs.id, stale))
        .run();
    console.warn(`[Auto] Marked ${stale.length} interrupted pending job(s) as skipped.`);
}
