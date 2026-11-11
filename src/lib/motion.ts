import type { Transition } from "framer-motion";

/**
 * Motion presets. Product UI: 120–250 ms, motion only to show a change of state.
 * framer-motion honours prefers-reduced-motion through <MotionConfig reducedMotion="user">
 * (mounted in ModeShell), which keeps opacity fades and drops movement.
 */

/** Exponential ease-out: fast start, gentle landing (entering, moving into place). */
export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
/** Ease-in for leaving the screen. */
export const EASE_IN: [number, number, number, number] = [0.55, 0, 1, 0.45];

export const DURATION = { fast: 0.12, base: 0.2, slow: 0.32 } as const;

/** Small, snappy spring for indicators and presses. */
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 560, damping: 42, mass: 0.7 };
/** Softer spring for sheets and panels. */
export const SPRING_PANEL: Transition = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 };

/** Fade + rise for content arriving (results, panels). */
export const RISE = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
    exit: { opacity: 0, y: 4, transition: { duration: DURATION.fast, ease: EASE_IN } },
};

/** Fade + slight scale for popovers and menus, from their anchor. */
export const POP = {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: DURATION.fast, ease: EASE_IN } },
};
