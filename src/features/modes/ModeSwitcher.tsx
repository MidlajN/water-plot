"use client";

import { APP_MODES, useMode } from "./ModeContext";

/** Auto / Edit / AI segmented control. */
export function ModeTabs({ className = "", fill = false }: { className?: string; fill?: boolean }) {
    const { mode, setMode } = useMode();

    return (
        <div role="tablist" aria-label="Mode" className={`flex gap-1 rounded-lg p-1 ${className}`}>
            {APP_MODES.map(({ id, label }) => {
                const selected = id === mode;

                return (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setMode(id)}
                        className={`h-9 rounded-md px-4 text-sm font-medium transition-colors duration-300 hover:bg-gray-100 ${
                            fill ? "flex-1" : ""
                        } ${selected ? "bg-gray-100 text-[#1c8096]" : "text-gray-600"}`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

/** Shows why the last Auto mode switch failed, if it did. */
export function AutoModeError({ className = "" }: { className?: string }) {
    const { autoError } = useMode();
    if (!autoError) return null;

    return (
        <p role="alert" className={`text-xs text-red-600 ${className}`}>
            {autoError}
        </p>
    );
}

