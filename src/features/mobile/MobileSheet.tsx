"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PaperPlaneTilt, Shapes } from "@phosphor-icons/react";

import { PrimaryButton } from "../desktop/parts";
import { ModeTabBar } from "../modes/ModeTabBar";
import { useEditor } from "../workspace/editor/EditorContext";
import { PencilIcon, SelectIcon, TextIcon } from "../workspace/editor/nav/icons";
import { usePlotter } from "../plotter/PlotterContext";
import { PlotterHud } from "../plotter/PlotterHud";
import { CanvasActions } from "./CanvasActions";
import { ElementsCarousel } from "./ElementsCarousel";
import { Joystick } from "./Joystick";
import { MobileTextEditor, type TextEditorHandle } from "./MobileTextEditor";

type Option = "select" | "pen" | "text" | "elements";

const OPTIONS: { id: Option; label: string; icon: (color: string) => ReactNode }[] = [
    { id: "select", label: "Select", icon: (color) => <SelectIcon width={24} height={24} strokeWidth={1.5} color={color} /> },
    { id: "pen", label: "Pen", icon: (color) => <PencilIcon width={20} height={24} strokeWidth={1.5} color={color} /> },
    { id: "text", label: "Text", icon: (color) => <TextIcon width={24} height={24} strokeWidth={1} color={color} /> },
    { id: "elements", label: "Elements", icon: (color) => <Shapes size={23} color={color} /> },
];

/**
 * Phone Edit controls: the page fills the top half (with undo, redo and more floating
 * over it) and this sheet the bottom half. Four tools across the top; tapping one shows
 * only that tool's panel, tapping it again folds the panel away. Below: Plot page (or
 * the plot's progress while one runs) and the mode tab bar.
 */
export function MobileSheet() {
    const { tool, setTool } = useEditor();
    const [panel, setPanel] = useState<Option | null>(null);
    const textEditor = useRef<TextEditorHandle>(null);
    const reduceMotion = useReducedMotion();

    const choose = (option: Option) => {
        if (panel === "text") textEditor.current?.finish();
        if (option === panel) {
            setPanel(null);
            return;
        }
        setPanel(option);
        if (option === "select") setTool("Select");
        if (option === "pen") setTool("Pen");
        if (option === "elements") setTool("Select");
        if (option === "text") textEditor.current?.start();
    };

    // Tapping text on the canvas opens the Text panel with that text loaded.
    const openText = useCallback(() => setPanel("text"), []);

    // With no panel open, the icon of the active drawing tool stays highlighted.
    const highlighted = (option: Option) =>
        panel ? panel === option : (option === "select" && tool === "Select") || (option === "pen" && tool === "Pen");

    return (
        <>
            <CanvasActions />

            <section
                aria-label="Edit controls"
                className="fixed inset-x-0 bottom-0 z-30 flex h-[50dvh] flex-col rounded-t-[1.75rem] bg-surface-raised shadow-[0_-0.5px_0_var(--line),0_-12px_36px_rgb(0_0_0/0.1)]"
            >
                <Joystick />

                <div aria-hidden className="mx-auto mb-1.5 mt-2 h-[5px] w-9 shrink-0 rounded-full bg-ink/[0.12]" />

                <nav aria-label="Tools" className="shrink-0 px-4">
                    <ul className="flex gap-1 rounded-2xl bg-grouped p-1">
                        {OPTIONS.map((option) => {
                            const active = highlighted(option.id);
                            return (
                                <li key={option.id} className="flex-1">
                                    <button
                                        type="button"
                                        aria-pressed={active}
                                        aria-expanded={panel === option.id}
                                        onClick={() => choose(option.id)}
                                        className={`press type-caption relative flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                                            active ? "text-teal" : "text-ink/70"
                                        }`}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="sheet-tool-highlight"
                                                aria-hidden
                                                className="absolute inset-0 rounded-xl bg-surface-raised shadow-hairline"
                                                transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.3 }}
                                            />
                                        )}
                                        <span className="relative flex h-6 items-center">{option.icon("currentColor")}</span>
                                        <span className="relative">{option.label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-3">
                    {/* Always mounted, so tapping text on the canvas can open it. */}
                    <MobileTextEditor ref={textEditor} open={panel === "text"} onRequestOpen={openText} />

                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                            key={panel ?? "none"}
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                        >
                            {panel === null && <Hint>Pick a tool above.</Hint>}
                            {panel === "select" && (
                                <Hint>
                                    Tap an object on the page to select it. Move it with the joystick; double-tap the joystick to send it
                                    to one of 9 spots on the page.
                                </Hint>
                            )}
                            {panel === "pen" && <Hint>Draw on the page with your finger.</Hint>}
                            {panel === "elements" && <ElementsCarousel />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <Footer />
            </section>
        </>
    );
}

function Hint({ children }: { children: ReactNode }) {
    return <p className="type-footnote px-2 py-2 text-center text-graphite">{children}</p>;
}

/** Plot page, or the plot's progress and controls while one is up; then the tab bar. */
function Footer() {
    const { send, sending, busy, gatewayConnected, error, dismiss, job } = usePlotter();

    return (
        <footer className="shrink-0 space-y-2 px-4 pt-2">
            {job ? (
                <PlotterHud compact showStatus={false} className="rounded-2xl bg-grouped p-3" />
            ) : (
                <PrimaryButton
                    icon={<PaperPlaneTilt size={18} weight="fill" />}
                    onClick={() => void send()}
                    disabled={!gatewayConnected || busy || sending}
                >
                    {sending ? "Sending…" : busy ? "Plotter busy" : "Plot page"}
                </PrimaryButton>
            )}
            {error && (
                <p role="alert" className="type-footnote flex items-center justify-center gap-2 text-center text-fault">
                    {error}
                    <button type="button" onClick={dismiss} className="font-semibold">
                        OK
                    </button>
                </p>
            )}
            <ModeTabBar docked />
        </footer>
    );
}
