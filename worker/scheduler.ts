import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { plotJobs } from "../src/lib/db/schema";
import { getAutoSettings } from "../src/features/auto/settings";
import { getRandomQuote } from "./quotes";
import { generatePlotSvg } from "./generatePlot";
import { sendPlotJob } from "./plotterSender";

const MINUTE = 60_000;
const TIMEZONE = "Asia/Kolkata";

function waitForNextMinute() {
  const delay = MINUTE - (Date.now() % MINUTE);

  return new Promise<void>((resolve) => {
    setTimeout(resolve, delay);
  });
}

async function createPlotJob() {
  const settings = getAutoSettings();

  if (!settings.enabled) {
    console.log("[Auto] Disabled. Skipping.");
    return;
  }

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

  const jobId = inserted[0].id;
  const quote = getRandomQuote();

  try {
    const svgPath = generatePlotSvg(
      jobId,
      quote,
      new Date(scheduledAt),
      settings.timezone,
    );

    db.update(plotJobs)
      .set({ quote, svgPath })
      .where(eq(plotJobs.id, jobId))
      .run();

    console.log(`[Auto] Generated SVG for job #${jobId}`);
    console.log(`[Auto] Quote: ${quote}`);
    console.log(`[Auto] SVG: ${svgPath}`);

    await sendPlotJob(jobId, svgPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    db.update(plotJobs)
      .set({
        status: "failed",
        error: message,
      })
      .where(eq(plotJobs.id, jobId))
      .run();

    console.error(`[Auto] Failed to generate job #${jobId}:`, error);
  }
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