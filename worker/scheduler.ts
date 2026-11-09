import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { autoSettings, plotJobs } from "../src/lib/db/schema";

const MINUTE = 60_000;

function waitForNextMinute() {
    const delay = MINUTE - (Date.now() % MINUTE);

    return new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
    });
}

async function createPlotJob() {
    const settings = db
        .select()
        .from(autoSettings)
        .where(eq(autoSettings.id, 1))
        .get();

    if (!settings?.enabled) {
        console.log("[Auto] Disabled. Skipping.");
        return;
    }

    // Normalize to the scheduled minute.
    const scheduledAt = new Date(
        Math.floor(Date.now() / MINUTE) * MINUTE,
    ).toISOString();

    const inserted = db
        .insert(plotJobs)
        .values({
            scheduledAt,
            status: "pending",
        })
        .onConflictDoNothing({ target: plotJobs.scheduledAt })
        .returning({ id: plotJobs.id })
        .all();

    if (inserted.length === 0) {
        console.log(`[Auto] Job already exists for ${scheduledAt}`);
        return;
    }

    console.log(`[Auto] Created job #${inserted[0].id} for ${scheduledAt}`);
}

export async function startScheduler() {
    console.log("[Auto] Scheduler started.");

    while (true) {
        await waitForNextMinute();

        try {
            await createPlotJob();
        } catch (error) {
            console.error("[Auto] Scheduler error:", error);
        }
    }
}