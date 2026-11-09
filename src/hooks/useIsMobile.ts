"use client";

import { useSyncExternalStore } from "react";

/** Below Tailwind's `md` breakpoint. */
const QUERY = "(max-width: 767px)";

const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(QUERY);
    media.addEventListener("change", onChange);
    // Some environments (device emulation, a few embedded browsers) skip the media
    // query's change event; a resize re-check is a cheap safety net.
    window.addEventListener("resize", onChange);
    return () => {
        media.removeEventListener("change", onChange);
        window.removeEventListener("resize", onChange);
    };
};

/** True on phone-sized screens. The server (and first paint) assumes desktop. */
export function useIsMobile(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(QUERY).matches,
        () => false,
    );
}
