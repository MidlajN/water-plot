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
            <main aria-label="AI mode" className="h-[52dvh] overflow-y-auto overscroll-contain bg-surface-sunken px-4 pt-5 pb-8">
                {idle ? (
                    <div className="flex h-full flex-col justify-center gap-2 pb-6 text-center">
                        <h2 className="text-title font-semibold tracking-[-0.01em] text-text">Create something beautiful</h2>
                        <p className="mx-auto max-w-xs text-ui text-muted">{INTRO}</p>
                    </div>
                ) : (
                    <AiResult compact />
                )}
            </main>
        );
    }

    return (
        <main aria-label="AI mode" className="h-full overflow-y-auto overscroll-contain bg-surface-sunken">
            <div className="mx-auto grid max-w-[680px] grid-cols-1 gap-8 px-8 pt-20 pb-16">
                <header className="grid gap-2">
                    <h2 className="text-display font-semibold tracking-[-0.025em] text-balance text-text">Create something beautiful</h2>
                    <p className="max-w-[56ch] text-body text-muted">{INTRO}</p>
                </header>
                <AiComposer />
                <AiResult />
            </div>
        </main>
    );
}
