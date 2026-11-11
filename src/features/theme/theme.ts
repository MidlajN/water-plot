"use client";

import { useEffect, useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "./bootstrap";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const CHOICE_EVENT = "plotter-studio:theme-choice";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readChoice(): ThemeChoice {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
        return "system";
    }
}

function systemTheme(): ResolvedTheme {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolve(choice: ThemeChoice): ResolvedTheme {
    return choice === "system" ? systemTheme() : choice;
}

/** Applies a theme to <html> without letting every transition animate the swap. */
function apply(theme: ResolvedTheme) {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") === theme) return;
    root.setAttribute("data-theme-switching", "");
    root.setAttribute("data-theme", theme);
    requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute("data-theme-switching")));
}

export function setThemeChoice(choice: ThemeChoice) {
    try {
        if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
        else localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
        // Storage blocked: the choice still applies for this visit.
    }
    apply(resolve(choice));
    window.dispatchEvent(new Event(CHOICE_EVENT));
}

function subscribeChoice(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key === THEME_STORAGE_KEY) {
            apply(resolve(readChoice()));
            onChange();
        }
    };
    window.addEventListener(CHOICE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener(CHOICE_EVENT, onChange);
        window.removeEventListener("storage", onStorage);
    };
}

function readResolved(): ResolvedTheme {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribeResolved(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
}

/** The viewer's theme choice and the theme actually showing. */
export function useTheme() {
    const choice = useSyncExternalStore(subscribeChoice, readChoice, () => "system" as const);
    const resolved = useSyncExternalStore(subscribeResolved, readResolved, () => "light" as const);
    return { choice, resolved, setChoice: setThemeChoice };
}

/** Calls `onChange` whenever the showing theme changes (e.g. to recolour the canvas). */
export function useThemeChange(onChange: (theme: ResolvedTheme) => void) {
    useEffect(() => {
        let last = readResolved();
        return subscribeResolved(() => {
            const next = readResolved();
            if (next !== last) onChange((last = next));
        });
    }, [onChange]);
}

/** Follows the system appearance while the choice is "system". Mount once. */
export function ThemeSync() {
    useEffect(() => {
        const media = window.matchMedia(DARK_QUERY);
        const onSystemChange = () => {
            if (readChoice() === "system") apply(systemTheme());
        };
        onSystemChange();
        media.addEventListener("change", onSystemChange);
        return () => media.removeEventListener("change", onSystemChange);
    }, []);
    return null;
}
