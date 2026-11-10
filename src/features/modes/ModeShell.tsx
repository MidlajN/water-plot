"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileSheet } from "../mobile/MobileSheet";
import { PlotterProvider } from "../plotter/PlotterContext";
import { AiStudioProvider } from "../ai/AiStudioContext";
import { AutoJobsProvider } from "../auto/AutoJobsContext";
import { AutoScreen } from "../auto/ui/AutoScreen";
import { DesktopSidebar } from "../desktop/DesktopSidebar";
import { WorkspaceProviders } from "../workspace/WorkspaceProvider";
import { WorkspaceSurface } from "../workspace/components/WorkspaceSurface";
import { AiMode } from "./AiMode";
import { ModeProvider, useMode } from "./ModeContext";

export function ModeShell() {
    return (
        <ModeProvider>
            <WorkspaceProviders>
                <PlotterProvider>
                    <AiStudioProvider>
                        <Layout />
                    </AiStudioProvider>
                </PlotterProvider>
            </WorkspaceProviders>
        </ModeProvider>
    );
}

function ActiveModePanel() {
    const { mode } = useMode();

    if (mode === "auto") return <AutoScreen />;
    if (mode === "ai") return <AiMode />;
    return null;
}

/**
 * Desktop: sidebar | viewer. Phones: Edit has the page on top and the tool sheet below;
 * Auto and AI are full-screen pages. All three share the mode tab bar.
 * Only one set of controls is mounted. Both get the Auto mode plots (they are only
 * fetched while Auto is open).
 */
function Layout() {
    const isMobile = useIsMobile();
    const { mode } = useMode();

    // One tree for both layouts: the viewer (and the Fabric canvas inside it) keeps its
    // place when the window crosses the breakpoint, so it is never remounted.
    return (
        <AutoJobsProvider>
            <div className="font-system text-ink antialiased md:flex md:h-screen md:overflow-hidden">
                {isMobile ? null : <DesktopSidebar />}
                <div className="relative min-w-0 md:h-screen md:flex-1 md:bg-desk">
                    <WorkspaceSurface />
                    <ActiveModePanel />
                </div>
                {isMobile && mode === "edit" ? <MobileSheet /> : null}
            </div>
        </AutoJobsProvider>
    );
}
