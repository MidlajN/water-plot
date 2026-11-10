"use client";

import { useSyncExternalStore } from "react";

// Polled a few times a second so the value turns over close to the real second; the
// component only re-renders when the second changes.
const subscribe = (onChange: () => void) => {
    const timer = setInterval(onChange, 250);
    return () => clearInterval(timer);
};

const getSnapshot = () => Math.floor(Date.now() / 1000);

/** The current Unix time in whole seconds, ticking live. 0 during server rendering. */
export function useSecond() {
    return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
