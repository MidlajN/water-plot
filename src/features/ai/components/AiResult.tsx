"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, CircleNotch, X } from "@phosphor-icons/react";

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
    const { activity } = useAiStudio();

    return (
        <div className="space-y-4">
            {activity.status === "working" && <Working activity={activity} />}
            {activity.status === "error" && <ErrorNotice activity={activity} />}
            {activity.status === "clarification" && <Clarification activity={activity} />}
            <DesignPreview compact={compact} />
        </div>
    );
}

function Working({ activity }: { activity: Extract<StudioActivity, { status: "working" }> }) {
    const { cancel } = useAiStudio();
    const [now, setNow] = useState(activity.startedAt);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
            <p className="type-footnote flex items-start gap-2.5 text-ink">
                <CircleNotch size={18} weight="bold" className="mt-px shrink-0 text-teal motion-safe:animate-spin" />
                <span>
                    <span className="font-semibold">{WORKING_LABEL[activity.action]}</span>
                    {now - activity.startedAt > SLOW_AFTER_MS && (
                        <span className="block text-graphite">Designs that need research can take up to a minute.</span>
                    )}
                </span>
            </p>
            <button
                type="button"
                onClick={cancel}
                className={`press type-footnote shrink-0 rounded-full bg-black/[0.055] px-3 py-1.5 font-semibold text-ink hover:bg-black/[0.08] ${focusRing}`}
            >
                Cancel
            </button>
        </div>
    );
}

function ErrorNotice({ activity }: { activity: Extract<StudioActivity, { status: "error" }> }) {
    const { dismiss, retry } = useAiStudio();

    return (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl bg-fault/8 px-4 py-3">
            <p className="type-footnote text-fault">{activity.message}</p>
            <div className="flex shrink-0 items-center gap-1">
                {activity.canRetry && (
                    <button
                        type="button"
                        onClick={retry}
                        className={`press type-footnote flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-ink hover:bg-white/70 ${focusRing}`}
                    >
                        <ArrowClockwise size={14} weight="bold" />
                        Try again
                    </button>
                )}
                <button type="button" aria-label="Dismiss" onClick={dismiss} className={`press rounded-full p-1.5 text-graphite hover:bg-white/70 ${focusRing}`}>
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    );
}

function Clarification({ activity }: { activity: Extract<StudioActivity, { status: "clarification" }> }) {
    const { generate } = useAiStudio();

    return (
        <div aria-live="polite" className="space-y-3 rounded-[1.25rem] bg-white px-4 py-4">
            <p className="type-body text-ink">{activity.question}</p>
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
