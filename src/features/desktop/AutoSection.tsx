"use client";

import { useMemo } from "react";

import { Field, Select } from "@/components/ui/field";
import { StatusDot, type Tone } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import { useAutoJobs } from "../auto/AutoJobsContext";
import type { PlotJobSummary } from "../auto/jobs";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const JOB_STATUS: Record<PlotJobSummary["status"], { label: string; tone: Tone }> = {
    pending: { label: "Waiting", tone: "neutral" },
    running: { label: "Plotting", tone: "accent" },
    completed: { label: "Plotted", tone: "ok" },
    failed: { label: "Failed", tone: "danger" },
    skipped: { label: "Skipped", tone: "warn" },
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
        <div className="grid grid-cols-1 gap-5">
            <p className="flex items-center gap-2.5 text-ui text-text">
                <StatusDot tone="ok" live />A new plot is made and sent every minute.
            </p>

            <Field label="Clock time zone" error={timezoneError ?? undefined}>
                {(props) => (
                    <Select {...props} value={timezone ?? ""} disabled={!timezone} onChange={(event) => void setTimezone(event.target.value)}>
                        {!timezone && <option value="">Loading…</option>}
                        {zoneOptions.map((zone) => (
                            <option key={zone} value={zone}>
                                {zone.replaceAll("_", " ")}
                            </option>
                        ))}
                    </Select>
                )}
            </Field>

            <div>
                <h3 className="mb-2 text-caption font-medium text-muted">Recent plots</h3>
                {status === "loading" && <p className="text-caption text-muted">Loading…</p>}
                {status === "error" && <p className="text-caption text-danger">Couldn&apos;t load recent plots.</p>}
                {status === "ready" && jobs.length === 0 && <p className="text-caption text-muted">Nothing yet. The first plot is made at the next minute.</p>}
                {jobs.length > 0 && (
                    <ul className="-mx-2 grid max-h-72 gap-px overflow-y-auto overscroll-contain" aria-label="Recent plots">
                        {jobs.map((job) => {
                            const { label, tone } = JOB_STATUS[job.status];
                            const isSelected = selected?.id === job.id;
                            return (
                                <li key={job.id}>
                                    <button
                                        type="button"
                                        aria-current={isSelected}
                                        title={job.error ?? undefined}
                                        onClick={() => select(job.id)}
                                        className={cn(
                                            "focus-ring flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left transition-colors duration-150",
                                            isSelected ? "bg-accent-soft" : "hover:bg-surface-hover",
                                        )}
                                    >
                                        <StatusDot tone={tone} live={job.status === "running"} />
                                        <span className={cn("numeric shrink-0 text-caption", isSelected ? "text-accent" : "text-text")}>{formatJobTime(job.scheduledAt)}</span>
                                        <span className="min-w-0 flex-1 truncate text-caption text-muted">{job.quote ?? "No quote"}</span>
                                        <span className="shrink-0 text-micro text-subtle">{label}</span>
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
