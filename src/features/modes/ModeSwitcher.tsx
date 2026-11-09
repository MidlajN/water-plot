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

/** Floating mode switcher, top-right on desktop (the mobile card has its own). */
export function ModeSwitcher() {
    return <ModeTabs className="fixed right-6 top-6 z-20 hidden bg-white shadow-md md:flex" />;
}
