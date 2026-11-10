"use client";

import { Section } from "@/components/ui/panel";
import { useMode } from "../modes/ModeContext";
import { AutoModeError, ModeTabs } from "../modes/ModeSwitcher";
import { usePlotter } from "../plotter/PlotterContext";
import { PlotterHud } from "../plotter/PlotterHud";
import { ActivityLog } from "./ActivityLog";
import { AutoSection } from "./AutoSection";
import { MachinePanel } from "./MachinePanel";
import { PlotSection } from "./PlotSection";
import { ThemeToggle } from "../theme/ThemeToggle";
import { BrandMark, ConnectionChip, MachineStateChip } from "./parts";

/**
 * Desktop sidebar: app and connection status, the mode tabs, then what to plot (per
 * mode), the current plot, the machine (position and jogging) and recent activity.
 */
export function DesktopSidebar() {
    const { mode } = useMode();
    const { job } = usePlotter();

    return (
        <aside aria-label="Plotter controls" className="flex h-screen w-[336px] shrink-0 flex-col border-r border-line bg-surface text-text">
            <header className="grid gap-4 px-5 pt-5 pb-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <BrandMark />
                        <h1 className="truncate text-body font-semibold tracking-[-0.01em]">Plotter Studio</h1>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <ConnectionChip />
                        <ThemeToggle />
                    </div>
                </div>
                <ModeTabs />
                <AutoModeError />
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain border-t border-line">
                {mode === "edit" && (
                    <Section title="Plot" aria-label="Plot">
                        <PlotSection />
                    </Section>
                )}
                {mode === "auto" && (
                    <Section title="Automatic plotting" aria-label="Automatic plotting">
                        <AutoSection />
                    </Section>
                )}
                {mode === "ai" && (
                    <Section title="AI Creative Studio" aria-label="AI Creative Studio">
                        <div className="grid gap-2 text-ui text-muted">
                            <p>Describe an idea in the viewer to get a design made for the pen: line art, a short poem, or both.</p>
                            <p>Drawings are black strokes only, fitted inside the 690 × 290 mm page. Words are lettered with the single-line plotter fonts.</p>
                        </div>
                    </Section>
                )}

                {job && (
                    <Section title="Current plot" aria-label="Current plot">
                        <PlotterHud showPosition={false} showStatus={false} />
                    </Section>
                )}

                <Section title="Machine" aria-label="Machine" aside={<MachineStateChip />}>
                    <MachinePanel />
                </Section>

                <Section title="Activity" aria-label="Activity">
                    <ActivityLog />
                </Section>
            </div>
        </aside>
    );
}
