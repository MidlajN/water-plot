"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PaperPlaneTilt, Shapes, SquaresFour } from "@phosphor-icons/react";

import { useMode } from "../modes/ModeContext";
import { AutoModeError, ModeTabs } from "../modes/ModeSwitcher";
import { AutoSection } from "../desktop/AutoSection";
import { AiComposer } from "../ai/components/AiComposer";
import { useEditor } from "../workspace/editor/EditorContext";
import { PencilIcon, SelectIcon, TextIcon } from "../workspace/editor/nav/icons";
import { usePlotter } from "../plotter/PlotterContext";
import { PlotterHud, PlotterStatus } from "../plotter/PlotterHud";
import { ElementsCarousel } from "./ElementsCarousel";
import { Joystick } from "./Joystick";
import { MobileTextEditor, type TextEditorHandle } from "./MobileTextEditor";
import { MoreMenu } from "./MoreMenu";

const ACTIVE = "#1c8096";
const IDLE = "#4b5563";

type Option = "select" | "pen" | "text" | "elements" | "mode";

const OPTIONS: { id: Option; label: string; icon: (color: string) => ReactNode }[] = [
    { id: "select", label: "Select", icon: (color) => <SelectIcon width={24} height={24} strokeWidth={1.5} color={color} /> },
    { id: "pen", label: "Pen", icon: (color) => <PencilIcon width={20} height={24} strokeWidth={1.5} color={color} /> },
    { id: "text", label: "Text", icon: (color) => <TextIcon width={24} height={24} strokeWidth={1} color={color} /> },
    { id: "elements", label: "Elements", icon: (color) => <Shapes size={23} color={color} /> },
    { id: "mode", label: "Mode", icon: (color) => <SquaresFour size={23} color={color} /> },
];

/**
 * Mobile controls: a card with rounded top corners covering the bottom half of the
 * screen. A row of option icons (like the desktop tool bar, laid out flat); tapping one
 * shows only that option's panel, tapping it again folds the panel away. The footer
 * holds Send (placeholder) and the More menu.
 */
export function MobileSheet() {
    const { mode } = useMode();
    const isEditMode = mode === "edit";
    const { tool, setTool } = useEditor();
    const [panel, setPanel] = useState<Option | null>(null);
    const textEditor = useRef<TextEditorHandle>(null);

    // Outside Edit mode only the mode switcher applies.
    const activePanel = isEditMode ? panel : "mode";

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
        activePanel ? activePanel === option : (option === "select" && tool === "Select") || (option === "pen" && tool === "Pen");

    return (
        <section
            aria-label="Controls"
            className="fixed inset-x-0 bottom-0 z-30 flex h-[50dvh] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        >
            {isEditMode && <Joystick />}

            <div aria-hidden className="mx-auto mb-1 mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-gray-200" />

            <nav aria-label="Options" className="shrink-0 px-4 pt-1">
                <ul className="flex justify-between gap-1 rounded-2xl bg-gray-50 p-1">
                    {OPTIONS.map((option) => {
                        const active = highlighted(option.id);
                        const disabled = !isEditMode && option.id !== "mode";
                        return (
                            <li key={option.id} className="flex-1">
                                <button
                                    type="button"
                                    aria-pressed={active}
                                    aria-expanded={activePanel === option.id}
                                    disabled={disabled}
                                    onClick={() => choose(option.id)}
                                    className={`flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors disabled:opacity-35 ${
                                        active ? "bg-white text-[#1c8096] shadow-sm" : "text-gray-500"
                                    }`}
                                >
                                    <span className="flex h-6 items-center">{option.icon(active ? ACTIVE : IDLE)}</span>
                                    {option.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
                {/* Always mounted, so tapping text on the canvas can open it. */}
                {isEditMode && <MobileTextEditor ref={textEditor} open={activePanel === "text"} onRequestOpen={openText} />}

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={activePanel ?? "none"}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                    >
                        {activePanel === null && <Hint>Pick an option above.</Hint>}
                        {activePanel === "select" && (
                            <Hint>
                                Tap an object on the page to select it. Move it with the joystick; double-tap the joystick to send it
                                to one of 9 spots on the page.
                            </Hint>
                        )}
                        {activePanel === "pen" && <Hint>Draw on the page with your finger.</Hint>}
                        {activePanel === "elements" && <ElementsCarousel />}
                        {activePanel === "mode" && (
                            <div className="space-y-3">
                                <ModeTabs fill className="bg-gray-50" />
                                <AutoModeError className="text-center" />
                                {mode === "auto" && <AutoSection />}
                                {mode === "ai" && <AiComposer compact />}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <Footer />
        </section>
    );
}

function Hint({ children }: { children: ReactNode }) {
    return <p className="px-1 py-2 text-center text-sm leading-relaxed text-gray-500">{children}</p>;
}

function Footer() {
    const { send, sending, busy, gatewayConnected, error, dismiss, job } = usePlotter();
    const isEditMode = useMode().mode === "edit";

    return (
        <footer className="shrink-0 space-y-2 border-t border-gray-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <PlotterHud compact />
            {error && (
                <p role="alert" className="flex items-center justify-center gap-2 text-center text-xs text-red-600">
                    {error}
                    <button type="button" onClick={dismiss} className="font-medium underline">
                        OK
                    </button>
                </p>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!isEditMode || !gatewayConnected || busy || sending}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1c8096] text-sm font-medium text-white transition-opacity active:opacity-80 disabled:opacity-45"
                >
                    <PaperPlaneTilt size={18} weight="bold" />
                    {sending ? "Sending…" : busy ? "Plotting…" : "Send"}
                </button>
                <MoreMenu />
            </div>
            {/* The progress card shows the status itself while a plot is up. */}
            {!job && (
                <div className="flex justify-center">
                    <PlotterStatus />
                </div>
            )}
        </footer>
    );
}
