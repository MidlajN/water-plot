"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileSheet } from "../mobile/MobileSheet";
import { WorkspaceProviders } from "../workspace/WorkspaceProvider";
import { WorkspaceSurface } from "../workspace/components/WorkspaceSurface";
import { AiMode } from "./AiMode";
import { AutoMode } from "./AutoMode";
import { ModeProvider, useMode } from "./ModeContext";
import { ModeSwitcher } from "./ModeSwitcher";

export function ModeShell() {
    return (
        <ModeProvider>
            <WorkspaceProviders>
                <WorkspaceSurface />
                <ActiveModePanel />
                <ModeSwitcher />
                <MobileControls />
            </WorkspaceProviders>
        </ModeProvider>
    );
}

function ActiveModePanel() {
    const { mode } = useMode();

    if (mode === "auto") return <AutoMode />;
    if (mode === "ai") return <AiMode />;
    return null;
}

/** Phones get the rounded bottom card with all controls instead of the floating ones. */
function MobileControls() {
    return useIsMobile() ? <MobileSheet /> : null;
}
