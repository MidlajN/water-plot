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
        <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 text-sm text-graphite">
            <p className="flex items-start gap-2.5">
                <CircleNotch size={18} className="mt-0.5 shrink-0 text-teal motion-safe:animate-spin" />
                <span>
                    {WORKING_LABEL[activity.action]}
                    {now - activity.startedAt > SLOW_AFTER_MS && (
                        <span className="block text-xs">Designs that need research can take up to a minute.</span>
                    )}
                </span>
            </p>
            <button type="button" onClick={cancel} className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium text-graphite hover:bg-desk hover:text-ink ${focusRing}`}>
                Cancel
            </button>
        </div>
    );
}

function ErrorNotice({ activity }: { activity: Extract<StudioActivity, { status: "error" }> }) {
    const { dismiss, retry } = useAiStudio();

    return (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-fault/25 bg-fault/5 px-4 py-3">
            <p className="text-sm leading-6 text-fault">{activity.message}</p>
            <div className="flex shrink-0 items-center gap-1">
                {activity.canRetry && (
                    <button
                        type="button"
                        onClick={retry}
                        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink hover:bg-white ${focusRing}`}
                    >
                        <ArrowClockwise size={14} />
                        Try again
                    </button>
                )}
                <button type="button" aria-label="Dismiss" onClick={dismiss} className={`rounded-md p-1 text-graphite hover:bg-white ${focusRing}`}>
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

function Clarification({ activity }: { activity: Extract<StudioActivity, { status: "clarification" }> }) {
    const { generate } = useAiStudio();

    return (
        <div aria-live="polite" className="space-y-3 rounded-xl border border-rule bg-white px-4 py-3.5">
            <p className="text-sm leading-6 text-ink">{activity.question}</p>
            {activity.suggestions.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {activity.suggestions.map((suggestion) => (
                        <li key={suggestion}>
                            <button
                                type="button"
                                onClick={() => void generate(suggestion)}
                                className={`rounded-full border border-rule px-3 py-1 text-xs text-ink transition-colors hover:bg-desk ${focusRing}`}
                            >
                                {suggestion}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-xs text-graphite">Pick one, or describe your idea in more detail.</p>
        </div>
    );
}
