import fs from "node:fs/promises";
import path from "node:path";
import { desc, eq } from "drizzle-orm";

import { db } from "../../lib/db";
import { plotJobs } from "../../lib/db/schema";

export interface PlotJobSummary {
    id: number;
    scheduledAt: string;
    status: (typeof plotJobs.$inferSelect)["status"];
    quote: string | null;
    error: string | null;
    startedAt: string | null;
    completedAt: string | null;
    hasSvg: boolean;
}

/** The newest Auto mode jobs first. */
export function listPlotJobs(limit = 20): PlotJobSummary[] {
    return db
        .select()
        .from(plotJobs)
        .orderBy(desc(plotJobs.id))
        .limit(limit)
        .all()
        .map(({ id, scheduledAt, status, quote, error, startedAt, completedAt, svgPath }) => ({
            id,
            scheduledAt,
            status,
            quote,
            error,
            startedAt,
            completedAt,
            hasSvg: Boolean(svgPath),
        }));
}

const PLOTS_DIRECTORY = path.resolve(process.cwd(), "data", "plots");

/** A job's generated SVG, or null if the job or its file is missing. Only reads inside data/plots. */
export async function readPlotJobSvg(id: number): Promise<string | null> {
    const job = db.select({ svgPath: plotJobs.svgPath }).from(plotJobs).where(eq(plotJobs.id, id)).get();
    if (!job?.svgPath) return null;

    const file = path.resolve(job.svgPath);
    if (path.dirname(file) !== PLOTS_DIRECTORY) return null;

    try {
        return await fs.readFile(file, "utf8");
    } catch {
        return null;
    }
}
