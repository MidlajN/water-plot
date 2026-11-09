"use client";

import { useMemo } from "react";

import { useAutoJobs } from "../auto/AutoJobsContext";
import type { PlotJobSummary } from "../auto/jobs";
import { focusRing } from "./parts";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const JOB_STATUS: Record<PlotJobSummary["status"], { label: string; dot: string }> = {
    pending: { label: "Waiting", dot: "bg-graphite/50" },
    running: { label: "Plotting", dot: "bg-teal" },
    completed: { label: "Plotted", dot: "bg-ok" },
    failed: { label: "Failed", dot: "bg-fault" },
    skipped: { label: "Skipped", dot: "bg-caution" },
};

/** Local time of a job; adds the date when it isn't today. */
export function formatJobTime(iso: string) {
    const date = new Date(iso);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return date.toDateString() === new Date().toDateString()
        ? time
        : `${date.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

/** Auto mode: scheduler status, time zone and the recent plots (selecting one previews it). Used in the desktop sidebar and the mobile card. */
export function AutoSection() {
    const auto = useAutoJobs();
    // Browsers list some zones under older names (Chrome has Asia/Calcutta, not
    // Asia/Kolkata), so the scheduler's default and the browser's own zone are added.
    const zones = useMemo(() => {
        let listed: string[] = [];
        try {
            listed = Intl.supportedValuesOf("timeZone");
        } catch {
            // Older browsers: only the extras below.
        }
        const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return [...new Set([...listed, DEFAULT_TIMEZONE, own])].sort();
    }, []);

    if (!auto) return null;
    const { jobs, status, selected, select, timezone, setTimezone, timezoneError } = auto;
    const zoneOptions = timezone && !zones.includes(timezone) ? [timezone, ...zones] : zones;

    return (
        <div className="space-y-4">
            <p className="flex items-center gap-2 text-[13px] text-ink">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
                A new plot is made and sent every minute.
            </p>

            <label className="block">
                <span className="mb-1 block text-xs text-graphite">Clock time zone</span>
                <select
                    value={timezone ?? ""}
                    disabled={!timezone}
                    onChange={(event) => void setTimezone(event.target.value)}
                    className={`h-10 w-full rounded-lg border border-rule bg-white px-2 text-base text-ink md:h-9 md:text-[13px] ${focusRing}`}
                >
                    {!timezone && <option value="">Loading…</option>}
                    {zoneOptions.map((zone) => (
                        <option key={zone} value={zone}>
                            {zone.replaceAll("_", " ")}
                        </option>
                    ))}
                </select>
                {timezoneError && <span className="mt-1 block text-xs text-fault">{timezoneError}</span>}
            </label>

            <div>
                <h3 className="mb-1.5 text-[13px] font-medium text-ink">Recent plots</h3>
                {status === "loading" && <p className="text-xs text-graphite">Loading…</p>}
                {status === "error" && <p className="text-xs text-fault">Couldn&apos;t load recent plots.</p>}
                {status === "ready" && jobs.length === 0 && (
                    <p className="text-xs text-graphite">Nothing yet. The first plot is made at the next minute.</p>
                )}
                {jobs.length > 0 && (
                    <ul className="-mx-2 max-h-72 overflow-y-auto" aria-label="Recent plots">
                        {jobs.map((job) => {
                            const { label, dot } = JOB_STATUS[job.status];
                            const isSelected = selected?.id === job.id;
                            return (
                                <li key={job.id}>
                                    <button
                                        type="button"
                                        aria-current={isSelected}
                                        title={job.error ?? undefined}
                                        onClick={() => select(job.id)}
                                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${focusRing} ${
                                            isSelected ? "bg-desk" : "hover:bg-desk/60"
                                        }`}
                                    >
                                        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink">{formatJobTime(job.scheduledAt)}</span>
                                        <span className="min-w-0 flex-1 truncate text-xs text-graphite">{job.quote ?? "No quote"}</span>
                                        <span className="shrink-0 text-xs text-graphite">{label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
