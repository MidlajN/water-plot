"use client";

import {
    createContext,
    useContext,
    useState,
    type Dispatch,
    type PropsWithChildren,
    type SetStateAction,
} from "react";

/** Top-level app modes. Only Edit (the canvas editor) has content so far. */
export type AppMode = "auto" | "edit" | "ai";

export const APP_MODES: ReadonlyArray<{ id: AppMode; label: string }> = [
    { id: "auto", label: "Auto" },
    { id: "edit", label: "Edit" },
    { id: "ai", label: "AI" },
];

interface ModeContextValue {
    mode: AppMode;
    setMode: Dispatch<SetStateAction<AppMode>>;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: PropsWithChildren) {
    const [mode, setMode] = useState<AppMode>("edit");

    return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
    const context = useContext(ModeContext);

    if (!context) {
        throw new Error("useMode must be used within ModeProvider");
    }

    return context;
}
