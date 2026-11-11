"use client";

import type { Icon } from "@phosphor-icons/react";
import { Clock, PencilSimple, Sparkle } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";

import { APP_MODES, useMode, type AppMode } from "./ModeContext";

const ICONS: Record<AppMode, Icon> = { auto: Clock, edit: PencilSimple, ai: Sparkle };

/**
 * Phone tab bar for the app modes, at the bottom centre in every mode. Auto and AI float
 * it over their scrolling page; Edit docks it at the bottom of the tool sheet. The
 * selected tab's highlight glides between tabs on a critically damped spring.
 */
export function ModeTabBar({ docked = false }: { docked?: boolean }) {
    const { mode, setMode } = useMode();
    const reduceMotion = useReducedMotion();

    return (
        <nav
            aria-label="Mode"
            className={`flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
                docked ? "pt-2" : "pointer-events-none fixed inset-x-0 bottom-0 z-30"
            }`}
        >
            <div role="tablist" className="material-float pointer-events-auto flex gap-1 rounded-full p-1">
                {APP_MODES.map(({ id, label }) => {
                    const selected = id === mode;
                    const TabIcon = ICONS[id];
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setMode(id)}
                            className={`press relative flex h-12 w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                                selected ? "text-teal" : "text-ink/70"
                            }`}
                        >
                            {selected && (
                                <motion.span
                                    layoutId="mode-tab-highlight"
                                    aria-hidden
                                    className="absolute inset-0 rounded-full bg-ink/[0.06]"
                                    transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.35 }}
                                />
                            )}
                            <TabIcon size={22} weight={selected ? "fill" : "regular"} className="relative" />
                            <span className="type-caption relative font-semibold">{label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
