import type { PlotJobSummary } from "./jobs";

/** How each Auto job status reads: a word, its dot and its text colour. */
export const JOB_STATUS: Record<PlotJobSummary["status"], { label: string; dot: string; text: string }> = {
    pending: { label: "Preparing", dot: "bg-graphite/50", text: "text-graphite" },
    running: { label: "Plotting", dot: "bg-teal", text: "text-teal" },
    completed: { label: "Plotted", dot: "bg-ok", text: "text-ok" },
    failed: { label: "Failed", dot: "bg-fault", text: "text-fault" },
    skipped: { label: "Skipped", dot: "bg-caution", text: "text-caution" },
};

/** "16:27" in local time. */
export function formatClockTime(at: number | string | Date) {
    return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Local time of a job; adds the date when it isn't today. */
export function formatJobTime(iso: string) {
    const date = new Date(iso);
    const time = formatClockTime(date);
    return date.toDateString() === new Date().toDateString()
        ? time
        : `${date.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

/** "0:23" for a number of seconds. */
export function formatCountdown(seconds: number) {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
