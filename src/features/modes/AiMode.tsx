"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { useAiStudio } from "../ai/AiStudioContext";
import { AiComposer } from "../ai/components/AiComposer";
import { AiResult } from "../ai/components/AiResult";
import { DesktopScreen, PhoneScreen } from "./ScreenLayout";

const INTRO = "Describe an idea and get a plotter-ready design: line art, a short poem, or both, in black strokes sized to the page.";

/**
 * AI mode: the AI Studio as a page of its own, on phones (with the mode tab bar) and in
 * the desktop viewer. The prompt comes first, then what's happening and the design.
 */
export function AiMode() {
    const isMobile = useIsMobile();
    const { activity, versions } = useAiStudio();
    const idle = activity.status === "idle" && versions.length === 0;

    if (isMobile) {
        return (
            <PhoneScreen title="AI Studio" label="AI mode">
                <div className="space-y-5 px-4">
                    {idle && <p className="type-body px-1 text-graphite">{INTRO}</p>}
                    <AiComposer compact />
                    <AiResult compact />
                </div>
            </PhoneScreen>
        );
    }

    return (
        <DesktopScreen title="AI Studio" subtitle={INTRO} label="AI mode">
            <div className="space-y-6">
                <AiComposer />
                <AiResult />
            </div>
        </DesktopScreen>
    );
}
