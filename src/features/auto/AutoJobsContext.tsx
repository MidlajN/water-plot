"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { useMode } from "../modes/ModeContext";
import { usePlotter } from "../plotter/PlotterContext";
import type { PlotJobSummary } from "./jobs";

const REFRESH_MS = 15_000;

interface AutoJobsValue {
    jobs: PlotJobSummary[];
    status: "loading" | "ready" | "error";
    selected: PlotJobSummary | null;
    /** Picks a plot; null follows the newest one as new plots arrive. */
    select: (id: number | null) => void;
    /** True while the selection follows the newest plot. */
    following: boolean;
    refresh: () => Promise<unknown>;
    timezone: string | null;
    setTimezone: (timezone: string) => Promise<void>;
    timezoneError: string | null;
}

const AutoJobsContext = createContext<AutoJobsValue | null>(null);

/**
 * Recent Auto mode plots and the scheduler's time zone, for the desktop sidebar and
 * viewer. Refreshes while Auto mode is open and whenever a plot starts or ends.
 */
export function AutoJobsProvider({ children }: PropsWithChildren) {
    const { mode } = useMode();
    const { job } = usePlotter();
    const [jobs, setJobs] = useState<PlotJobSummary[]>([]);
    const [status, setStatus] = useState<AutoJobsValue["status"]>("loading");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [timezone, setTimezoneState] = useState<string | null>(null);
    const [timezoneError, setTimezoneError] = useState<string | null>(null);

    // State is only set in promise callbacks, so effects can call this.
    const refresh = useCallback(
        () =>
            fetch("/api/auto/jobs?limit=20", { cache: "no-store" })
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json() as Promise<{ jobs: PlotJobSummary[] }>;
                })
                .then((data) => {
                    setJobs(data.jobs);
                    setStatus("ready");
                })
                .catch(() => setStatus((current) => (current === "ready" ? current : "error"))),
        [],
    );

    const isAuto = mode === "auto";
    // Refetch while Auto is open, on a timer and whenever a plot starts or finishes.
    const jobKey = `${job?.id ?? ""}:${job?.phase ?? ""}`;

    useEffect(() => {
        if (!isAuto) return;
        const timer = setInterval(() => void refresh(), REFRESH_MS);
        const first = setTimeout(() => void refresh(), 0);
        return () => {
            clearInterval(timer);
            clearTimeout(first);
        };
    }, [isAuto, jobKey, refresh]);

    useEffect(() => {
        if (!isAuto) return;
        fetch("/api/auto", { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((settings) => settings && setTimezoneState(settings.timezone))
            .catch(() => {});
    }, [isAuto]);

    const setTimezone = useCallback(async (next: string) => {
        const previous = timezone;
        setTimezoneState(next);
        setTimezoneError(null);
        try {
            const response = await fetch("/api/auto", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timezone: next }),
            });
            if (!response.ok) throw new Error();
        } catch {
            setTimezoneState(previous);
            setTimezoneError("Couldn't save the time zone. Try again.");
        }
    }, [timezone]);

    // The chosen plot, or the newest one (also when the chosen one has aged out of the list).
    const chosen = jobs.find((item) => item.id === selectedId);
    const selected = chosen ?? jobs[0] ?? null;
    const following = !chosen;

    const value = useMemo<AutoJobsValue>(
        () => ({ jobs, status, selected, select: setSelectedId, following, refresh, timezone, setTimezone, timezoneError }),
        [jobs, status, selected, following, refresh, timezone, setTimezone, timezoneError],
    );

    return <AutoJobsContext.Provider value={value}>{children}</AutoJobsContext.Provider>;
}

/** Null outside the provider (it is only mounted on desktop). */
export function useAutoJobs() {
    return useContext(AutoJobsContext);
}
