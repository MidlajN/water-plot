/** "m:ss" for a number of seconds. */
export function formatDuration(seconds: number) {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** "HH:MM:SS" local clock time. */
export function formatClock(at: number | string | Date) {
    return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
