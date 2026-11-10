"use client";

import { useMemo } from "react";
import { CaretUpDown } from "@phosphor-icons/react";

import { useAutoJobs } from "../AutoJobsContext";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Auto settings as an inset grouped list: the clock's time zone (the row opens the
 * native picker) and a footnote on what Auto does and how it stops.
 */
export function AutoSettings() {
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
    const { timezone, setTimezone, timezoneError } = auto;
    const options = timezone && !zones.includes(timezone) ? [timezone, ...zones] : zones;

    return (
        <section aria-labelledby="auto-settings-title">
            <h2 id="auto-settings-title" className="type-footnote mb-1.5 px-4 font-medium uppercase tracking-[0.04em] text-graphite">
                Settings
            </h2>
            <div className="overflow-hidden rounded-[0.875rem] bg-white">
                {/* The whole row is the target; the native select sits invisibly on top. */}
                <label className="relative flex min-h-12 items-center gap-3 px-4 transition-colors has-[select:active]:bg-grouped has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-inset has-[select:focus-visible]:ring-teal">
                    <span className="type-body flex-1 text-ink">Clock time zone</span>
                    <span className="type-body flex min-w-0 items-center gap-1 text-graphite">
                        <span className="truncate">{timezone ? timezone.replaceAll("_", " ") : "Loading…"}</span>
                        <CaretUpDown size={14} weight="bold" className="shrink-0 opacity-60" />
                    </span>
                    <select
                        value={timezone ?? ""}
                        disabled={!timezone}
                        onChange={(event) => void setTimezone(event.target.value)}
                        className="absolute inset-0 cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-default"
                    >
                        {!timezone && <option value="">Loading…</option>}
                        {options.map((zone) => (
                            <option key={zone} value={zone}>
                                {zone.replaceAll("_", " ")}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {timezoneError ? (
                <p role="alert" className="type-footnote mt-1.5 px-4 text-fault">
                    {timezoneError}
                </p>
            ) : (
                <p className="type-footnote mt-1.5 px-4 text-graphite">
                    Auto draws a clock and a quote every minute. Switching to Edit or AI turns it off.
                </p>
            )}
        </section>
    );
}
