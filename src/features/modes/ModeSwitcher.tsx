"use client";

import { Segmented } from "../desktop/parts";
import { APP_MODES, useMode } from "./ModeContext";

const OPTIONS = APP_MODES.map(({ id, label }) => ({ value: id, label }));

/** Auto / Edit / AI segmented control (desktop sidebar). */
export function ModeTabs({ className = "" }: { className?: string }) {
    const { mode, setMode } = useMode();

    return <Segmented kind="tab" label="Mode" options={OPTIONS} value={mode} onChange={setMode} className={className} />;
}

/** Shows why the last Auto mode switch failed, if it did. */
export function AutoModeError({ className = "" }: { className?: string }) {
    const { autoError } = useMode();
    if (!autoError) return null;

    return (
        <p role="alert" className={`type-footnote text-fault ${className}`}>
            {autoError}
        </p>
    );
}
