"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ConnectionChip } from "../desktop/parts";
import { ThemeToggle } from "../theme/ThemeToggle";
import { AutoModeError } from "./ModeSwitcher";
import { ModeTabBar } from "./ModeTabBar";

/**
 * Phone page for a mode that scrolls (Auto, AI): a large title that hands over to a small
 * one in a translucent bar as it scrolls under, the connection status, and the floating
 * mode tab bar. Children lay out their own side padding (some run edge to edge).
 */
export function PhoneScreen({ title, label, children }: { title: string; label: string; children: ReactNode }) {
    const heading = useRef<HTMLHeadingElement>(null);
    // The small title and the bar's material appear once the large title scrolls under it.
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const element = heading.current;
        if (!element) return;
        const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
            rootMargin: "-44px 0px 0px 0px",
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        <main aria-label={label} className="min-h-dvh bg-grouped text-ink">
            <header className="sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
                <div
                    aria-hidden
                    className={`material-bar absolute inset-0 transition-opacity duration-200 ${collapsed ? "opacity-100" : "opacity-0"}`}
                />
                <div className="relative flex h-11 items-center justify-end px-4">
                    <span
                        aria-hidden
                        className={`type-headline absolute inset-x-0 text-center transition-opacity duration-200 ${
                            collapsed ? "opacity-100" : "opacity-0"
                        }`}
                    >
                        {title}
                    </span>
                    <span className="relative flex items-center gap-1">
                        <ThemeToggle />
                        <ConnectionChip />
                    </span>
                </div>
            </header>

            <div className="space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
                <div className="space-y-1 px-5">
                    <h1 ref={heading} className="type-large-title">
                        {title}
                    </h1>
                    <AutoModeError />
                </div>
                {children}
            </div>

            <ModeTabBar />
        </main>
    );
}

/** Desktop page for a mode that scrolls, filling the viewer beside the sidebar. */
export function DesktopScreen({
    title,
    subtitle,
    label,
    children,
}: {
    title: string;
    subtitle: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <main aria-label={label} className="h-full overflow-y-auto bg-grouped text-ink">
            <div className="mx-auto max-w-3xl space-y-8 px-8 py-12">
                <header className="space-y-1 px-1">
                    <h1 className="type-large-title">{title}</h1>
                    <p className="type-body text-graphite">{subtitle}</p>
                </header>
                {children}
            </div>
        </main>
    );
}
