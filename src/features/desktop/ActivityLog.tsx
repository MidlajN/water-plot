"use client";

import { formatClock } from "../plotter/format";
import { usePlotter } from "../plotter/PlotterContext";

const LEVEL_DOT = { info: "", warn: "bg-caution", error: "bg-fault" } as const;

/** Recent plotter events since the page opened, newest first. */
export function ActivityLog() {
    const { activity } = usePlotter();

    if (activity.length === 0) {
        return <p className="type-footnote text-graphite">Plotter events will show up here.</p>;
    }

    return (
        <ol className="max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-live="polite">
            {activity.map((entry) => (
                <li key={entry.id} className="type-footnote flex items-baseline gap-3">
                    <time dateTime={new Date(entry.at).toISOString()} className="type-caption shrink-0 tabular-nums text-graphite">
                        {formatClock(entry.at)}
                    </time>
                    <span className={`min-w-0 ${entry.level === "error" ? "text-fault" : "text-ink"}`}>
                        {LEVEL_DOT[entry.level] && (
                            <span aria-hidden className={`mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full ${LEVEL_DOT[entry.level]}`} />
                        )}
                        {entry.text}
                    </span>
                </li>
            ))}
        </ol>
    );
}
