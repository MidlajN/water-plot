"use client";

/* Pieces shared by the tool rail buttons (SideBar, ElementsMenu). */

import { motion, useReducedMotion } from "framer-motion";

export const ACTIVE_COLOR = "#1c8096";
export const IDLE_COLOR = "#3a4250";

/** Classes shared by every tool rail button. */
export const toolButtonClass = (active: boolean, open = false) =>
    `press relative flex h-10 w-10 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal ${
        active ? "" : open ? "bg-black/[0.06]" : "hover:bg-black/[0.05]"
    }`;

/** The selected tool's tint; glides between tools on a critically damped spring. */
export function ToolHighlight() {
    const reduceMotion = useReducedMotion();
    return (
        <motion.span
            layoutId="tool-rail-highlight"
            aria-hidden
            className="absolute inset-0 rounded-xl bg-teal/12"
            transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.3 }}
        />
    );
}

/** Hover label to the right of a tool rail button. */
export function ToolTooltip({ label, hidden = false }: { label: string; hidden?: boolean }) {
    if (hidden) return null;
    return (
        <div
            aria-hidden
            className="type-caption pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink/90 px-2.5 py-1 font-semibold text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-300"
        >
            {label}
        </div>
    );
}
