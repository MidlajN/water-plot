"use client";

import { useMode } from "../modes/ModeContext";
import { AutoModeError, ModeTabs } from "../modes/ModeSwitcher";
import { usePlotter } from "../plotter/PlotterContext";
import { PlotterHud } from "../plotter/PlotterHud";
import { ActivityLog } from "./ActivityLog";
import { AutoSection } from "./AutoSection";
import { MachinePanel } from "./MachinePanel";
import { PlotSection } from "./PlotSection";
import { ConnectionChip, MachineStateChip, Section } from "./parts";

/**
 * Desktop sidebar: app and connection status, the mode tabs, then what to plot (per
 * mode), the current plot, the machine (position and jogging) and recent activity.
 */
export function DesktopSidebar() {
    const { mode } = useMode();
    const { job } = usePlotter();

    return (
        <aside aria-label="Plotter controls" className="flex h-screen w-[340px] shrink-0 flex-col border-r border-rule bg-white text-ink">
            <header className="space-y-3 border-b border-rule px-5 pb-4 pt-5">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-[15px] font-semibold tracking-tight">Plotter Studio</h1>
                    <ConnectionChip />
                </div>
                <ModeTabs fill className="bg-desk/70 [&_button]:h-8 [&_button]:text-[13px]" />
                <AutoModeError />
            </header>

            <div className="flex-1 overflow-y-auto">
                {mode === "edit" && (
                    <Section title="Plot">
                        <PlotSection />
                    </Section>
                )}
                {mode === "auto" && (
                    <Section title="Automatic plotting">
                        <AutoSection />
                    </Section>
                )}
                {mode === "ai" && (
                    <Section title="AI Creative Studio">
                        <div className="space-y-2 text-xs leading-5 text-graphite">
                            <p>Describe an idea in the viewer to get a design made for the pen: line art, a short poem, or both.</p>
                            <p>Drawings are black strokes only, fitted inside the 690 × 290 mm page. Words are lettered with the single-line plotter fonts.</p>
                        </div>
                    </Section>
                )}

                {job && (
                    <Section title="Current plot">
                        <PlotterHud showPosition={false} showStatus={false} />
                    </Section>
                )}

                <Section title="Machine" aside={<MachineStateChip />}>
                    <MachinePanel />
                </Section>

                <Section title="Activity">
                    <ActivityLog />
                </Section>
            </div>
        </aside>
    );
}
