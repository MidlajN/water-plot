"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Stop } from "@phosphor-icons/react";

/**
 * Pause / Resume and Stop for a running plot. Stopping can't be undone, so it asks for a
 * second tap within 3 s; otherwise the button settles back.
 */
export function PlotControls({
    held,
    active = true,
    size = "md",
    onHold,
    onResume,
    onAbort,
}: {
    held: boolean;
    active?: boolean;
    size?: "sm" | "md";
    onHold: () => Promise<void>;
    onResume: () => Promise<void>;
    onAbort: () => Promise<void>;
}) {
    const [confirmStop, setConfirmStop] = useState(false);

    useEffect(() => {
        if (!confirmStop) return;
        const timeout = setTimeout(() => setConfirmStop(false), 3000);
        return () => clearTimeout(timeout);
    }, [confirmStop]);

    const stop = () => {
        if (!confirmStop) {
            setConfirmStop(true);
            return;
        }
        setConfirmStop(false);
        void onAbort();
    };

    const height = size === "sm" ? "h-9 rounded-[0.625rem] type-footnote" : "h-11 rounded-xl type-body";
    const iconSize = size === "sm" ? 15 : 17;

    return (
        <div className="flex gap-2.5">
            <button
                type="button"
                disabled={!active}
                onClick={() => void (held ? onResume() : onHold())}
                className={`press flex flex-1 items-center justify-center gap-2 bg-ink/[0.055] font-semibold text-ink outline-none hover:bg-ink/[0.08] focus-visible:ring-2 focus-visible:ring-teal ${height}`}
            >
                {held ? <Play size={iconSize} weight="fill" /> : <Pause size={iconSize} weight="fill" />}
                {held ? "Resume" : "Pause"}
            </button>
            <button
                type="button"
                disabled={!active}
                onClick={stop}
                className={`press flex flex-1 items-center justify-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-fault ${height} ${
                    confirmStop ? "bg-fault text-on-accent" : "bg-fault/10 text-fault hover:bg-fault/15"
                }`}
            >
                <Stop size={iconSize} weight="fill" />
                {confirmStop ? "Tap again to stop" : "Stop"}
            </button>
        </div>
    );
}
