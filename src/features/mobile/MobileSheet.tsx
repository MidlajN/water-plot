"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PaperPlaneTilt, Shapes, SquaresFour } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DURATION, EASE_IN, EASE_OUT } from "@/lib/motion";
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

/** Icons draw in the button's text colour, so they follow the theme. */
const ACTIVE = "currentColor";
const IDLE = "currentColor";

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
            className="fixed inset-x-0 bottom-0 z-30 flex h-[50dvh] flex-col rounded-t-sheet border-t border-line bg-surface-raised text-text shadow-overlay"
        >
            {isEditMode && <Joystick />}

            <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1 w-9 shrink-0 rounded-full bg-line-strong" />

            <nav aria-label="Options" className="shrink-0 px-4 pt-1">
                <ul className="flex justify-between gap-1 rounded-panel bg-surface-sunken p-1">
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
                                    className={cn(
                                        "focus-ring flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-[10px] py-1.5 text-micro font-medium transition-[background-color,color,transform] duration-150 active:scale-95 disabled:opacity-35",
                                        active ? "bg-surface-raised text-accent shadow-hairline dark:bg-surface-pressed" : "text-muted",
                                    )}
                                >
                                    <span className="flex h-6 items-center">{option.icon(active ? ACTIVE : IDLE)}</span>
                                    {option.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
                {/* Always mounted, so tapping text on the canvas can open it. */}
                {isEditMode && <MobileTextEditor ref={textEditor} open={activePanel === "text"} onRequestOpen={openText} />}

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={activePanel ?? "none"}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } }}
                        exit={{ opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE_IN } }}
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
                            <div className="grid grid-cols-1 gap-3">
                                <ModeTabs />
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
    return <p className="px-1 py-2 text-center text-ui text-muted">{children}</p>;
}

function Footer() {
    const { send, sending, busy, gatewayConnected, error, dismiss, job } = usePlotter();
    const isEditMode = useMode().mode === "edit";

    return (
        <footer className="grid shrink-0 grid-cols-1 gap-2 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <PlotterHud compact />
            {error && (
                <p role="alert" className="flex items-center justify-center gap-2 rounded-control bg-danger-soft px-3 py-2 text-center text-caption text-danger">
                    {error}
                    <button type="button" onClick={dismiss} className="focus-ring rounded-[4px] font-semibold underline underline-offset-2">
                        OK
                    </button>
                </p>
            )}
            <div className="flex items-center gap-2">
                <Button variant="primary" size="lg" className="flex-1" busy={sending} onClick={() => void send()} disabled={!isEditMode || !gatewayConnected || busy}>
                    <PaperPlaneTilt weight="fill" />
                    {busy && !sending ? "Plotting…" : "Send"}
                </Button>
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
