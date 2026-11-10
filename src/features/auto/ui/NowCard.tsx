"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { formatDuration } from "../../plotter/format";
import { PlotControls } from "../../plotter/PlotControls";
import { usePlotter } from "../../plotter/PlotterContext";
import { useAutoJobs } from "../AutoJobsContext";
import { formatClockTime, formatCountdown, formatJobTime, JOB_STATUS } from "../format";
import { useSecond } from "../useSecond";

type Tone = "neutral" | "ok" | "active" | "caution" | "fault";

const DOT: Record<Tone, string> = {
    neutral: "bg-graphite/50",
    ok: "bg-ok",
    active: "bg-teal",
    caution: "bg-caution",
    fault: "bg-fault",
};

const EYEBROW: Record<Tone, string> = {
    neutral: "text-graphite",
    ok: "text-ok",
    active: "text-teal",
    caution: "text-caution",
    fault: "text-fault",
};

interface NowState {
    /** Changes whenever the card shows a different kind of state (drives the cross-fade). */
    key: string;
    tone: Tone;
    eyebrow: string;
    title: ReactNode;
    detail?: ReactNode;
    /** 0–1 for a plot in progress, "minute" for the wait until the next plot, or none. */
    bar?: number | "minute";
}

/**
 * The glanceable answer to "what is the plotter doing?": plotting (with progress and
 * Pause / Stop), waiting for the next minute (with a countdown), or what is wrong.
 */
export function NowCard() {
    const auto = useAutoJobs();
    const { link, gatewayConnected, telemetry, job, progress, held, hold, resume, abort } = usePlotter();
    const second = useSecond();
    // When this screen opened: right after Auto is switched on, the newest plot can be old.
    const [openedAt] = useState(second);
    const reduceMotion = useReducedMotion();

    const jobs = auto?.jobs ?? [];
    const latest = jobs[0];
    const runningAuto = jobs.find((item) => item.status === "running");
    const plotting = job?.phase === "running";

    const state = ((): NowState => {
        if (link !== "online") {
            return {
                key: "link",
                tone: "neutral",
                eyebrow: link === "connecting" ? "Connecting" : "Reconnecting",
                title: "Reaching Plotter Studio…",
                detail: "Live status will be back in a moment.",
            };
        }
        if (!gatewayConnected) {
            return {
                key: "offline",
                tone: "fault",
                eyebrow: "Plotter offline",
                title: "Can’t reach the plotter",
                detail: "Check that the Pi gateway is running. Auto plots can’t be sent until it’s back.",
            };
        }
        if (telemetry?.state === "Alarm") {
            return {
                key: "alarm",
                tone: "fault",
                eyebrow: "Alarm",
                title: "The machine is in alarm",
                detail: "Clear the alarm on the plotter to keep plotting.",
            };
        }
        if (plotting) {
            const percent = progress?.percent ?? 0;
            const which = runningAuto ? ` · ${formatClockTime(runningAuto.scheduledAt)} plot` : "";
            return {
                key: "plotting",
                tone: held ? "caution" : "active",
                eyebrow: `${held ? "Paused" : "Plotting"}${which}`,
                title: (
                    <span className="flex items-baseline gap-2.5">
                        <span className="tabular-nums">{percent.toFixed(0)}%</span>
                        {progress && (
                            <span className="type-body font-normal tracking-normal text-graphite tabular-nums">
                                {formatDuration(progress.estimated_remaining_seconds)} left
                            </span>
                        )}
                    </span>
                ),
                detail: progress
                    ? `Line ${progress.current_line.toLocaleString()} of ${progress.total_lines.toLocaleString()}`
                    : "Starting…",
                bar: percent / 100,
            };
        }

        // The scheduler adds a row every minute (even a skipped one). None for a while, after
        // this screen has had time to see one, means it isn't running.
        const quietFor = latest ? second - Date.parse(latest.scheduledAt) / 1000 : 0;
        if (latest && quietFor > 150 && second - openedAt > 90) {
            return {
                key: "quiet",
                tone: "caution",
                eyebrow: "No new plots",
                title: "Auto seems to have stopped",
                detail: `Nothing has been drawn since ${formatJobTime(latest.scheduledAt)}. Check that the Auto worker is running on the server.`,
            };
        }

        // Waiting for the scheduler, which makes a plot at the start of every minute.
        const nextAt = (Math.floor(second / 60) + 1) * 60;
        const left = nextAt - second;
        const preparing = latest?.status === "pending" && Date.parse(latest.scheduledAt) / 1000 > second - 60;
        if (preparing) {
            return {
                key: "preparing",
                tone: "neutral",
                eyebrow: "Preparing",
                title: `Drawing the ${formatClockTime(latest.scheduledAt)} plot`,
                detail: "It’s sent to the plotter as soon as it’s ready.",
            };
        }

        const last = latest && latest.status !== "pending" ? latest : jobs.find((item) => item.status !== "pending");
        const lastLine =
            last && (last.status === "failed" || last.status === "skipped") ? (
                <span className={JOB_STATUS[last.status].text}>
                    Last plot {JOB_STATUS[last.status].label.toLowerCase()}
                    {last.error ? `: ${last.error}` : "."}
                </span>
            ) : last ? (
                `Last plot ${formatClockTime(last.scheduledAt)}`
            ) : null;

        return {
            key: "waiting",
            tone: "ok",
            eyebrow: "Waiting",
            title: (
                <span>
                    Next plot in <span className="tabular-nums">{formatCountdown(left % 60)}</span>
                </span>
            ),
            detail: (
                <>
                    <span className="tabular-nums">At {second ? formatClockTime(nextAt * 1000) : "–"}</span>
                    {lastLine && <span aria-hidden> · </span>}
                    {lastLine}
                </>
            ),
            bar: "minute",
        };
    })();

    return (
        <section aria-label="Now" className="relative overflow-hidden rounded-[1.25rem] bg-white px-5 pb-5 pt-4">
            {/* Announce state changes only; the countdown ticks every second and would be noise. */}
            <p className="sr-only" aria-live="polite">
                {state.eyebrow}
            </p>
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                    key={state.key}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                >
                    <p className={`type-footnote flex items-center gap-2 font-semibold ${EYEBROW[state.tone]}`}>
                        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${DOT[state.tone]}`} />
                        {state.eyebrow}
                    </p>
                    <h2 className="type-title mt-1.5 text-ink">{state.title}</h2>

                    {state.bar !== undefined && (
                        <div
                            className="mt-4 h-1.5 overflow-hidden rounded-full bg-grouped"
                            {...(typeof state.bar === "number"
                                ? {
                                      role: "progressbar",
                                      "aria-label": "Plot progress",
                                      "aria-valuemin": 0,
                                      "aria-valuemax": 100,
                                      "aria-valuenow": Math.round(state.bar * 100),
                                  }
                                : { "aria-hidden": true })}
                        >
                            {state.bar === "minute" ? (
                                // Re-keyed each minute so the fill restarts in step with the clock.
                                <MinuteFill key={Math.floor(second / 60)} />
                            ) : (
                                <div
                                    className={`h-full origin-left rounded-full transition-transform duration-500 ease-out ${
                                        held ? "bg-caution" : "bg-teal"
                                    }`}
                                    style={{ transform: `scaleX(${Math.min(1, Math.max(0, state.bar))})` }}
                                />
                            )}
                        </div>
                    )}

                    {state.detail && <p className="type-footnote mt-2.5 text-graphite">{state.detail}</p>}
                </motion.div>
            </AnimatePresence>

            {/* Pause / Stop slide open under the progress only while a plot runs. */}
            <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                    plotting ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
                aria-hidden={!plotting}
                inert={!plotting}
            >
                <div className="overflow-hidden">
                    <div className="pt-4">
                        <PlotControls held={held} onHold={hold} onResume={resume} onAbort={abort} active={plotting} />
                    </div>
                </div>
            </div>
        </section>
    );
}

/**
 * Fills across the minute on the compositor. The start offset is read once, on mount
 * (to the millisecond): changing a running animation's delay would jump it forward.
 */
function MinuteFill() {
    const [startOffset] = useState(() => (Date.now() % 60_000) / 1000);
    return (
        <div
            className="h-full origin-left rounded-full bg-ok/45"
            style={{ animation: `minute-fill 60s linear ${-startOffset}s forwards` }}
        />
    );
}
