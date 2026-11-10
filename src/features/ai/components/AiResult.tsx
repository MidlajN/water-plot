"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowClockwise, Question, Warning, X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { RISE } from "@/lib/motion";
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
                    <motion.div key="working" {...RISE}>
                        <Working activity={activity} withSheet={!current} compact={compact} />
                    </motion.div>
                )}
                {activity.status === "error" && (
                    <motion.div key="error" {...RISE}>
                        <ErrorNotice activity={activity} />
                    </motion.div>
                )}
                {activity.status === "clarification" && (
                    <motion.div key="clarification" {...RISE}>
                        <Clarification activity={activity} />
                    </motion.div>
                )}
            </AnimatePresence>
            <DesignPreview compact={compact} />
        </div>
    );
}

/**
 * Progress line, plus (for the first design) a shimmering blank sheet in the result's
 * place, so the layout doesn't jump when the design arrives.
 */
function Working({ activity, withSheet, compact }: { activity: Extract<StudioActivity, { status: "working" }>; withSheet: boolean; compact: boolean }) {
    const { cancel } = useAiStudio();
    const [now, setNow] = useState(activity.startedAt);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const status = (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2.5 text-ui text-text">
                <Spinner className="text-accent" />
                <span>
                    {WORKING_LABEL[activity.action]}
                    {now - activity.startedAt > SLOW_AFTER_MS && <span className="block text-caption text-muted">Busy moments can take up to a minute or two.</span>}
                </span>
            </p>
            <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
            </Button>
        </div>
    );

    if (!withSheet) return status;

    return (
        <Card className={compact ? "grid gap-3 p-3" : "grid gap-4 p-5"}>
            {status}
            <div className="rounded-control bg-surface-sunken p-3">
                <div aria-hidden className="shimmer aspect-[690/290] w-full rounded-[2px] bg-paper/80 shadow-paper" />
            </div>
        </Card>
    );
}

function ErrorNotice({ activity }: { activity: Extract<StudioActivity, { status: "error" }> }) {
    const { dismiss, retry } = useAiStudio();

    return (
        <div role="alert" className="flex items-start gap-3 rounded-panel bg-danger-soft px-4 py-3">
            <Warning weight="fill" className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="min-w-0 flex-1 text-ui text-danger">{activity.message}</p>
            <div className="-my-1 flex shrink-0 items-center gap-1">
                {activity.canRetry && (
                    <Button variant="ghost" size="sm" onClick={retry} className="text-text">
                        <ArrowClockwise /> Try again
                    </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismiss} className="text-danger">
                    <X />
                </Button>
            </div>
        </div>
    );
}

function Clarification({ activity }: { activity: Extract<StudioActivity, { status: "clarification" }> }) {
    const { generate } = useAiStudio();

    return (
        <Card aria-live="polite" className="grid gap-3 px-4 py-4">
            <p className="flex items-start gap-2.5 text-body text-text">
                <Question weight="fill" className="mt-1 size-4 shrink-0 text-accent" />
                {activity.question}
            </p>
            {activity.suggestions.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pl-6.5">
                    {activity.suggestions.map((suggestion) => (
                        <li key={suggestion}>
                            <Chip size="sm" onClick={() => void generate(suggestion)}>
                                {suggestion}
                            </Chip>
                        </li>
                    ))}
                </ul>
            )}
            <p className="pl-6.5 text-caption text-muted">Pick one, or describe your idea in more detail.</p>
        </Card>
    );
}
