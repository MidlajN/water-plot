"use client";

import { useSyncExternalStore } from "react";

/** Below Tailwind's `md` breakpoint. */
const QUERY = "(max-width: 767px)";

const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
};

/** True on phone-sized screens. The server (and first paint) assumes desktop. */
export function useIsMobile(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(QUERY).matches,
        () => false,
    );
}
