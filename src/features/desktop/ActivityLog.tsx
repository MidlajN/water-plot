"use client";

import { StatusDot } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import { formatClock } from "../plotter/format";
import { usePlotter } from "../plotter/PlotterContext";

/** Recent plotter events since the page opened, newest first. */
export function ActivityLog() {
    const { activity } = usePlotter();

    if (activity.length === 0) {
        return <p className="text-caption text-muted">Plotter events will show up here.</p>;
    }

    return (
        <ol className="grid max-h-64 gap-2 overflow-y-auto overscroll-contain pr-1" aria-live="polite">
            {activity.map((entry) => (
                <li key={entry.id} className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-ui">
                    <time dateTime={new Date(entry.at).toISOString()} className="numeric text-micro text-subtle">
                        {formatClock(entry.at)}
                    </time>
                    <span className={cn("flex min-w-0 items-baseline gap-2", entry.level === "error" ? "text-danger" : "text-text")}>
                        {entry.level !== "info" && <StatusDot tone={entry.level === "error" ? "danger" : "warn"} className="translate-y-[-1px] self-center" />}
                        <span className="min-w-0">{entry.text}</span>
                    </span>
                </li>
            ))}
        </ol>
    );
}
