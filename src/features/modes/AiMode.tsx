"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { useAiStudio } from "../ai/AiStudioContext";
import { AiComposer } from "../ai/components/AiComposer";
import { AiResult } from "../ai/components/AiResult";

const INTRO = "Describe an idea and get a plotter-ready design: line art, a short poem, or both, in black strokes sized to the page.";

/**
 * AI mode viewer: the AI Creative Studio. On desktop the prompt and the result share
 * the viewer; on phones the prompt lives in the bottom card and the result shows here.
 */
export function AiMode() {
    const isMobile = useIsMobile();
    const { activity, versions } = useAiStudio();
    const idle = activity.status === "idle" && versions.length === 0;

    if (isMobile) {
        return (
            <main aria-label="AI mode" className="h-[52dvh] overflow-y-auto bg-desk px-4 pb-8 pt-5">
                {idle ? (
                    <div className="flex h-full flex-col justify-center gap-2 pb-6 text-center">
                        <h2 className="text-xl font-semibold text-ink">Create something beautiful.</h2>
                        <p className="mx-auto max-w-xs text-sm leading-6 text-graphite">{INTRO}</p>
                    </div>
                ) : (
                    <AiResult compact />
                )}
            </main>
        );
    }

    return (
        <main aria-label="AI mode" className="h-full overflow-y-auto bg-desk">
            <div className="mx-auto max-w-2xl space-y-7 px-8 py-16">
                <header className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-ink">Create something beautiful.</h2>
                    <p className="max-w-xl text-[15px] leading-6 text-graphite">{INTRO}</p>
                </header>
                <AiComposer />
                <AiResult />
            </div>
        </main>
    );
}
