"use client";

import { useMode } from "../modes/ModeContext";
import { AutoModeError, ModeTabs } from "../modes/ModeSwitcher";
import { usePlotter } from "../plotter/PlotterContext";
import { PlotterHud } from "../plotter/PlotterHud";
import { ActivityLog } from "./ActivityLog";
import { MachinePanel } from "./MachinePanel";
import { PlotSection } from "./PlotSection";
import { ConnectionChip, MachineStateChip, Section } from "./parts";

/**
 * Desktop sidebar: app and connection status, the mode tabs, then what to plot (per
 * mode), the current plot, the machine (position and jogging) and recent activity.
 * Auto mode's content lives in the viewer, so its sidebar keeps only the machine
 * (folded) and the activity.
 */
export function DesktopSidebar() {
    const { mode } = useMode();
    const { job } = usePlotter();

    return (
        <aside aria-label="Plotter controls" className="flex h-screen w-[340px] shrink-0 flex-col border-r border-separator bg-panel text-ink">
            <header className="space-y-3.5 border-b border-separator px-5 pb-4 pt-5">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="type-headline">Plotter Studio</h1>
                    <ConnectionChip />
                </div>
                <ModeTabs />
                <AutoModeError />
            </header>

            <div className="flex-1 overflow-y-auto">
                {mode === "edit" && (
                    <Section title="Plot">
                        <PlotSection />
                    </Section>
                )}
                {mode === "ai" && (
                    <Section title="AI Studio">
                        <div className="type-footnote space-y-2 text-graphite">
                            <p>Describe an idea in the viewer to get a design made for the pen: line art, a short poem, or both.</p>
                            <p>Drawings are black strokes only, fitted inside the 690 × 290 mm page. Words are lettered with the single-line plotter fonts.</p>
                        </div>
                    </Section>
                )}

                {/* Auto mode shows the plot's progress in its own Now card. */}
                {job && mode !== "auto" && (
                    <Section title="Current plot">
                        <PlotterHud showPosition={false} showStatus={false} />
                    </Section>
                )}

                {/* Auto runs the machine on its own; jogging is tucked away there. */}
                <Section key={mode === "auto" ? "machine-auto" : "machine"} title="Machine" aside={<MachineStateChip />} collapsible={mode === "auto"}>
                    <MachinePanel />
                </Section>

                <Section title="Activity">
                    <ActivityLog />
                </Section>
            </div>
        </aside>
    );
}
