"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowClockwise, CircleNotch, Question, Warning, X } from "@phosphor-icons/react";

import { focusRing } from "../../desktop/parts";
import { useAiStudio, type StudioActivity } from "../AiStudioContext";
import { DesignPreview } from "./DesignPreview";

/** After this long, the waiting message explains that research can take a while. */
const SLOW_AFTER_MS = 8000;

const WORKING_LABEL = {
    generate: "Designing your piece…",
    regenerate: "Making another version…",
    refine: "Refining the design…",
} as const;

/** What's happening now (progress, a question or an error) above the design preview. */
export function AiResult({ compact = false }: { compact?: boolean }) {
    const { activity, current } = useAiStudio();

    return (
        <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout" initial={false}>
                {activity.status === "working" && (
                    <Rise key="working">
                        <Working activity={activity} withSheet={!current} />
                    </Rise>
                )}
                {activity.status === "error" && (
                    <Rise key="error">
                        <ErrorNotice activity={activity} />
                    </Rise>
                )}
                {activity.status === "clarification" && (
                    <Rise key="clarification">
                        <Clarification activity={activity} />
                    </Rise>
                )}
            </AnimatePresence>
            <DesignPreview compact={compact} />
        </div>
    );
}

/** A notice arriving: a short lift into place, or a plain fade with Reduce Motion. */
function Rise({ children }: { children: ReactNode }) {
    const reduceMotion = useReducedMotion();
    return (
        <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Progress line, plus (for the first design) a shimmering blank sheet in the result's
 * place, so the layout doesn't jump when the design arrives.
 */
function Working({ activity, withSheet }: { activity: Extract<StudioActivity, { status: "working" }>; withSheet: boolean }) {
    const { cancel } = useAiStudio();
    const [now, setNow] = useState(activity.startedAt);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="space-y-3 rounded-2xl bg-surface-raised px-4 py-3">
            <div role="status" aria-live="polite" className="flex items-center justify-between gap-4">
                <p className="type-footnote flex items-start gap-2.5 text-ink">
                    <CircleNotch size={18} weight="bold" className="mt-px shrink-0 text-teal motion-safe:animate-spin" />
                    <span>
                        <span className="font-semibold">{WORKING_LABEL[activity.action]}</span>
                        {now - activity.startedAt > SLOW_AFTER_MS && (
                            <span className="block text-graphite">Busy moments can take up to a minute or two.</span>
                        )}
                    </span>
                </p>
                <button
                    type="button"
                    onClick={cancel}
                    className={`press type-footnote shrink-0 rounded-full bg-ink/[0.055] px-3 py-1.5 font-semibold text-ink hover:bg-ink/[0.08] ${focusRing}`}
                >
                    Cancel
                </button>
            </div>
            {withSheet && (
                <div className="rounded-xl bg-grouped p-3">
                    <div aria-hidden className="shimmer aspect-[690/290] w-full rounded-[2px] bg-paper/80 shadow-paper" />
                </div>
            )}
        </div>
    );
}

function ErrorNotice({ activity }: { activity: Extract<StudioActivity, { status: "error" }> }) {
    const { dismiss, retry } = useAiStudio();

    return (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl bg-fault/8 px-4 py-3">
            <p className="type-footnote flex items-start gap-2 text-fault">
                <Warning size={16} weight="bold" className="mt-0.5 shrink-0" />
                {activity.message}
            </p>
            <div className="flex shrink-0 items-center gap-1">
                {activity.canRetry && (
                    <button
                        type="button"
                        onClick={retry}
                        className={`press type-footnote flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-ink hover:bg-surface-raised/70 ${focusRing}`}
                    >
                        <ArrowClockwise size={14} weight="bold" />
                        Try again
                    </button>
                )}
                <button type="button" aria-label="Dismiss" onClick={dismiss} className={`press rounded-full p-1.5 text-graphite hover:bg-surface-raised/70 ${focusRing}`}>
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    );
}

function Clarification({ activity }: { activity: Extract<StudioActivity, { status: "clarification" }> }) {
    const { generate } = useAiStudio();

    return (
        <div aria-live="polite" className="space-y-3 rounded-[1.25rem] bg-surface-raised px-4 py-4">
            <p className="type-body flex items-start gap-2 text-ink">
                <Question size={18} weight="bold" className="mt-0.5 shrink-0 text-teal" />
                {activity.question}
            </p>
            {activity.suggestions.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {activity.suggestions.map((suggestion) => (
                        <li key={suggestion}>
                            <button
                                type="button"
                                onClick={() => void generate(suggestion)}
                                className={`press type-footnote rounded-full bg-teal/10 px-3.5 py-1.5 font-semibold text-teal hover:bg-teal/15 ${focusRing}`}
                            >
                                {suggestion}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <p className="type-caption text-graphite">Pick one, or describe your idea in more detail.</p>
        </div>
    );
}
