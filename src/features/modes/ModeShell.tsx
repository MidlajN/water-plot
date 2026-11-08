"use client";

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
            </WorkspaceProviders>
            <ActiveModePanel />
            <ModeSwitcher />
        </ModeProvider>
    );
}

function ActiveModePanel() {
    const { mode } = useMode();

    if (mode === "auto") return <AutoMode />;
    if (mode === "ai") return <AiMode />;
    return null;
}
