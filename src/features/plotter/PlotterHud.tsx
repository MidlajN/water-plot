"use client";

import { X } from "@phosphor-icons/react";

import { formatDuration } from "./format";
import { PlotControls } from "./PlotControls";
import { usePlotter } from "./PlotterContext";

/** Plotter connection as a dot and a word. */
export function PlotterStatus({ className = "" }: { className?: string }) {
    const { link, gatewayConnected, telemetry } = usePlotter();

    const [color, label] =
        link !== "online"
            ? ["bg-graphite/50", link === "connecting" ? "Connecting…" : "App offline"]
            : !gatewayConnected
              ? ["bg-fault", "Plotter offline"]
              : telemetry?.state === "Alarm"
                ? ["bg-caution", "Alarm"]
                : ["bg-ok", telemetry?.state ?? "Online"];

    return (
        <span className={`type-caption inline-flex items-center gap-1.5 font-semibold text-graphite ${className}`}>
            <span aria-hidden className={`h-2 w-2 rounded-full ${color}`} />
            {label}
        </span>
    );
}

/**
 * Progress and controls for the current plot: state, progress bar, line count, time
 * left, live X/Y/Z, Pause / Resume and Stop (which asks for a second tap).
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
            ? "Plot stopped"
            : "Plot failed";
    const fill = job.phase === "failed" ? "bg-fault" : held || job.phase === "aborted" ? "bg-caution" : job.phase === "done" ? "bg-ok" : "bg-teal";

    return (
        <section aria-label="Plot progress" className={`space-y-2.5 ${className}`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="type-body font-semibold text-ink">{title}</span>
                    {showStatus && <PlotterStatus />}
                </div>
                <span className="type-body font-semibold tabular-nums text-ink">{percent.toFixed(0)}%</span>
            </div>

            <div
                role="progressbar"
                aria-label="Plot progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
                className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]"
            >
                <div
                    className={`h-full origin-left rounded-full transition-transform duration-500 ease-out ${fill}`}
                    style={{ transform: `scaleX(${Math.min(1, Math.max(0, percent / 100))})` }}
                />
            </div>

            <div className="type-caption flex items-center justify-between tabular-nums text-graphite">
                <span>
                    {running && progress
                        ? `Line ${progress.current_line.toLocaleString()} of ${progress.total_lines.toLocaleString()}`
                        : job.result
                          ? `Took ${formatDuration(job.result.duration_seconds)}`
                          : running
                            ? "Starting…"
                            : ""}
                </span>
                {running && progress && <span>{formatDuration(progress.estimated_remaining_seconds)} left</span>}
            </div>

            {showPosition && telemetry && (
                <dl aria-label="Position" className="type-caption grid grid-cols-3 gap-1 rounded-lg bg-black/[0.04] px-2.5 py-1.5 tabular-nums">
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                        <div key={axis} className="flex gap-1.5">
                            <dt className="font-semibold text-graphite">{axis}</dt>
                            <dd className="text-ink">{telemetry.mpos[index].toFixed(2)}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {running ? (
                <PlotControls held={held} size={compact ? "sm" : "md"} onHold={hold} onResume={resume} onAbort={abort} />
            ) : (
                <button
                    type="button"
                    onClick={dismiss}
                    className={`press flex w-full items-center justify-center gap-1.5 bg-black/[0.055] font-semibold text-ink outline-none hover:bg-black/[0.08] focus-visible:ring-2 focus-visible:ring-teal ${
                        compact ? "type-footnote h-9 rounded-[0.625rem]" : "type-body h-11 rounded-xl"
                    }`}
                >
                    <X size={compact ? 14 : 16} weight="bold" />
                    Dismiss
                </button>
            )}
        </section>
    );
}
