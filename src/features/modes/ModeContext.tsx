"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";

/** Top-level app modes. Only Edit (the canvas editor) has content so far. */
export type AppMode = "auto" | "edit" | "ai";

export const APP_MODES: ReadonlyArray<{ id: AppMode; label: string }> = [
    { id: "auto", label: "Auto" },
    { id: "edit", label: "Edit" },
    { id: "ai", label: "AI" },
];

interface ModeContextValue {
    mode: AppMode;
    /** Switches mode; entering or leaving Auto turns the scheduler on or off. */
    setMode: (mode: AppMode) => void;
    /** Why the last Auto switch failed, if it did. */
    autoError: string | null;
}

const ModeContext = createContext<ModeContextValue | null>(null);

async function setAutoEnabled(enabled: boolean) {
    const response = await fetch("/api/auto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/**
 * Holds the app mode. The Auto tab mirrors the scheduler: the app opens in Auto when
 * the scheduler is on, and switching into or out of Auto turns it on or off. If that
 * request fails, the mode switches back.
 */
export function ModeProvider({ children }: PropsWithChildren) {
    const [mode, setModeState] = useState<AppMode>("edit");
    const [autoError, setAutoError] = useState<string | null>(null);
    const modeRef = useRef(mode);
    // Bumped on every user switch, so stale responses (and the startup fetch) are ignored.
    const requestId = useRef(0);

    const apply = (next: AppMode) => {
        modeRef.current = next;
        setModeState(next);
    };

    useEffect(() => {
        const startedAt = requestId.current;
        fetch("/api/auto", { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((settings: { enabled?: boolean } | null) => {
                if (settings?.enabled && requestId.current === startedAt) apply("auto");
            })
            .catch(() => {
                // The scheduler state is unknown; stay in Edit.
            });
    }, []);

    const setMode = useCallback((next: AppMode) => {
        const previous = modeRef.current;
        if (next === previous) return;

        const id = ++requestId.current;
        apply(next);

        const enabled = next === "auto";
        if (enabled === (previous === "auto")) return;

        setAutoEnabled(enabled).then(
            () => {
                if (id === requestId.current) setAutoError(null);
            },
            () => {
                if (id !== requestId.current) return;
                apply(previous);
                setAutoError(`Couldn't turn Auto mode ${enabled ? "on" : "off"}. Try again.`);
            },
        );
    }, []);

    return <ModeContext.Provider value={{ mode, setMode, autoError }}>{children}</ModeContext.Provider>;
}

export function useMode() {
    const context = useContext(ModeContext);

    if (!context) {
        throw new Error("useMode must be used within ModeProvider");
    }

    return context;
}
