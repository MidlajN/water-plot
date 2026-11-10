"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { DesktopScreen, PhoneScreen } from "../../modes/ScreenLayout";
import { AutoSettings } from "./AutoSettings";
import { NowCard } from "./NowCard";
import { PlotCarousel } from "./PlotCarousel";

/**
 * Auto mode, phone first: what the plotter is doing now, the recent plots to swipe
 * through, and the clock's time zone. On desktop the same parts fill the viewer next to
 * the sidebar.
 */
export function AutoScreen() {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <PhoneScreen title="Auto" label="Auto mode">
                <div className="px-4">
                    <NowCard />
                </div>
                <PlotCarousel />
                <div className="px-4">
                    <AutoSettings />
                </div>
            </PhoneScreen>
        );
    }

    return (
        <DesktopScreen title="Auto" subtitle="A new clock and quote, drawn every minute." label="Auto mode">
            <NowCard />
            <div className="-mx-8">
                <PlotCarousel />
            </div>
            <AutoSettings />
        </DesktopScreen>
    );
}
