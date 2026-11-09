"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Stop, X } from "@phosphor-icons/react";

import { usePlotter } from "./PlotterContext";

import { formatDuration } from "./format";

const ACCENT = "#1c8096";

/** Plotter connection as a dot and a word. */
export function PlotterStatus({ className = "" }: { className?: string }) {
    const { link, gatewayConnected, telemetry } = usePlotter();

    const [color, label] =
        link !== "online"
            ? ["bg-gray-400", link === "connecting" ? "Connecting…" : "App offline"]
            : !gatewayConnected
              ? ["bg-red-500", "Plotter offline"]
              : telemetry?.state === "Alarm"
                ? ["bg-amber-500", "Alarm"]
                : ["bg-emerald-500", telemetry?.state ?? "Online"];

    return (
        <span className={`inline-flex items-center gap-1.5 text-xs text-gray-600 ${className}`}>
            <span aria-hidden className={`h-2 w-2 rounded-full ${color}`} />
            {label}
        </span>
    );
}

/**
 * Progress and controls for the current plot: state, progress bar, line count, time
 * left, live X/Y/Z, Hold/Resume and Abort (which asks for a second tap).
 * Renders nothing when no job is running or waiting to be dismissed.
 */
export function PlotterHud({
    compact = false,
    showPosition = !compact,
    showStatus = true,
    className = "",
}: {
    compact?: boolean;
    /** Live X/Y/Z under the progress (off where a machine panel shows it). */
    showPosition?: boolean;
    /** Connection dot next to the title (off where a header shows it). */
    showStatus?: boolean;
    className?: string;
}) {
    const { job, progress, telemetry, held, hold, resume, abort, dismiss } = usePlotter();
    const [confirmAbort, setConfirmAbort] = useState(false);

    useEffect(() => {
        if (!confirmAbort) return;
        const timeout = setTimeout(() => setConfirmAbort(false), 3000);
        return () => clearTimeout(timeout);
    }, [confirmAbort]);

    if (!job) return null;

    const running = job.phase === "running";
    const percent = running ? (progress?.percent ?? 0) : (job.percent ?? (job.phase === "done" ? 100 : 0));
    const title = running
        ? held
            ? "Paused"
            : "Plotting"
        : job.phase === "done"
          ? "Plot finished"
          : job.phase === "aborted"
            ? "Plot aborted"
            : "Plot failed";

    const onAbort = () => {
        if (!confirmAbort) {
            setConfirmAbort(true);
            return;
        }
        setConfirmAbort(false);
        void abort();
    };

    return (
        <section aria-label="Plot progress" className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{title}</span>
                    {showStatus && <PlotterStatus />}
                </div>
                <span className="font-mono text-sm font-medium tabular-nums text-gray-700">{percent.toFixed(0)}%</span>
            </div>

            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
                className="h-2 overflow-hidden rounded-full bg-gray-100"
            >
                <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${percent}%`, background: job.phase === "failed" ? "#dc2626" : ACCENT }}
                />
            </div>

            <div className="flex items-center justify-between font-mono text-xs tabular-nums text-gray-500">
                <span>
                    {running && progress
                        ? `Line ${progress.current_line.toLocaleString()} / ${progress.total_lines.toLocaleString()}`
                        : job.result
                          ? `Took ${formatDuration(job.result.duration_seconds)}`
                          : running
                            ? "Starting…"
                            : ""}
                </span>
                {running && progress && <span>{formatDuration(progress.estimated_remaining_seconds)} left</span>}
            </div>

            {showPosition && telemetry && (
                <dl aria-label="Position" className="grid grid-cols-3 gap-1 rounded-lg bg-gray-50 px-2 py-1.5 text-xs tabular-nums">
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                        <div key={axis} className="flex gap-1">
                            <dt className="font-medium text-gray-500">{axis}</dt>
                            <dd className="text-gray-800">{telemetry.mpos[index].toFixed(2)}</dd>
                        </div>
                    ))}
                </dl>
            )}

            <div className="flex gap-2">
                {running ? (
                    <>
                        <button
                            type="button"
                            onClick={() => void (held ? resume() : hold())}
                            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 active:bg-gray-100"
                        >
                            {held ? <Play size={16} weight="fill" /> : <Pause size={16} weight="fill" />}
                            {held ? "Resume" : "Pause"}
                        </button>
                        <button
                            type="button"
                            onClick={onAbort}
                            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
                                confirmAbort ? "bg-red-600 text-white" : "border border-red-200 text-red-600 active:bg-red-50"
                            }`}
                        >
                            <Stop size={16} weight="fill" />
                            {confirmAbort ? "Tap to abort" : "Abort"}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={dismiss}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 active:bg-gray-100"
                    >
                        <X size={16} />
                        Dismiss
                    </button>
                )}
            </div>
        </section>
    );
}
