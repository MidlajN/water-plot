"use client";

import { SegmentedControl } from "@/components/ui/segmented";
import { APP_MODES, useMode, type AppMode } from "./ModeContext";

const OPTIONS = APP_MODES.map(({ id, label }) => ({ value: id, label }));

/** Auto / Edit / AI segmented control. */
export function ModeTabs({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" }) {
    const { mode, setMode } = useMode();
    return <SegmentedControl aria-label="Mode" options={OPTIONS} value={mode} onChange={(value: AppMode) => setMode(value)} size={size} block className={className} />;
}

/** Shows why the last Auto mode switch failed, if it did. */
export function AutoModeError({ className = "" }: { className?: string }) {
    const { autoError } = useMode();
    if (!autoError) return null;

    return (
        <p role="alert" className={`text-caption text-danger ${className}`}>
            {autoError}
        </p>
    );
}
