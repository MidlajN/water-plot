"use client";

import { APP_MODES, useMode } from "./ModeContext";

/** Floating Auto / Edit / AI switcher, top-right. */
export function ModeSwitcher() {
    const { mode, setMode } = useMode();

    return (
        <div
            role="tablist"
            aria-label="Mode"
            className="fixed right-6 top-6 z-20 flex gap-1 rounded-lg bg-white p-1 shadow-md"
        >
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
                            selected ? "bg-gray-100 text-[#1c8096]" : "text-gray-600"
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
