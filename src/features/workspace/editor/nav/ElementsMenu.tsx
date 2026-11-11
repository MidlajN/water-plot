"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
    ILLUSTRATION_CATEGORIES,
    illustrationUrl,
    useIllustrations,
    useInsertIllustration,
} from "@/features/illustrations/useIllustrations";
import type { Illustration } from "@/features/illustrations/library";
import { useEditor, type DrawingElement } from "../EditorContext";
import { SHAPES } from "./shapes";
import { ACTIVE_COLOR, IDLE_COLOR, ToolHighlight, ToolTooltip, toolButtonClass } from "./toolbar";

/**
 * Elements button: opens a dropdown with the drawing shapes and the illustration
 * library (served by /api/illustrations). Picking a shape arms the Elements tool;
 * picking an illustration places it in the middle of the page.
 */
export function ElementsMenu() {
    const { tool, element, setTool, setElement } = useEditor();
    const { library, load: loadLibrary, ensureLoaded } = useIllustrations();
    const { inserting, error: insertError, insert, clearError } = useInsertIllustration();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLLIElement>(null);
    const reduceMotion = useReducedMotion();

    const active = tool === "Elements";
    const current = SHAPES.find((shape) => shape.element === element) ?? SHAPES[1];

    const toggle = () => {
        if (!open) ensureLoaded();
        clearError();
        setOpen(!open);
    };

    // Close on a click outside the menu or on Escape.
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const pickShape = (shape: DrawingElement) => {
        setElement(shape);
        setTool("Elements");
        setOpen(false);
    };

    const insertIllustration = async (illustration: Illustration) => {
        if (await insert(illustration)) setOpen(false);
    };

    const highlighted = active || open;

    return (
        <li ref={containerRef} className="group relative">
            <button
                type="button"
                aria-label="Elements"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggle}
                className={toolButtonClass(active, open)}
            >
                {active && <ToolHighlight />}
                <span className="relative">{current.icon(highlighted ? ACTIVE_COLOR : IDLE_COLOR)}</span>
            </button>
            <ToolTooltip label="Elements" hidden={open} />

            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        aria-label="Elements"
                        // Grows out of its button (top-left origin) and returns the same way.
                        className="material-float absolute left-full top-0 z-20 ml-3 max-h-[70vh] w-72 origin-top-left overflow-y-auto rounded-2xl p-3"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                    >
                        <MenuSection title="Shapes">
                            <div className="grid grid-cols-4 gap-1">
                                {SHAPES.map((shape) => {
                                    const selected = active && element === shape.element;
                                    return (
                                        <button
                                            key={shape.element}
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={selected}
                                            aria-label={shape.label}
                                            title={shape.label}
                                            onClick={() => pickShape(shape.element)}
                                            className={`press flex h-12 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                                                selected ? "bg-teal/12" : "hover:bg-ink/[0.05]"
                                            }`}
                                        >
                                            {shape.icon(selected ? ACTIVE_COLOR : IDLE_COLOR)}
                                        </button>
                                    );
                                })}
                            </div>
                        </MenuSection>

                        {library.status === "loading" && <p className="type-footnote py-4 text-center text-graphite">Loading illustrations…</p>}

                        {library.status === "error" && (
                            <p className="type-footnote py-4 text-center text-graphite">
                                Couldn&apos;t load illustrations.{" "}
                                <button type="button" onClick={() => void loadLibrary()} className="font-semibold text-teal">
                                    Retry
                                </button>
                            </p>
                        )}

                        {library.status === "ready" &&
                            ILLUSTRATION_CATEGORIES.map(({ id, label }) => {
                                const items = library.illustrations.filter((item) => item.category === id);
                                if (!items.length) return null;
                                return (
                                    <MenuSection key={id} title={label}>
                                        <div className="grid grid-cols-4 gap-1">
                                            {items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    role="menuitem"
                                                    aria-label={`Add ${item.name}`}
                                                    title={item.name}
                                                    disabled={inserting !== null}
                                                    onClick={() => void insertIllustration(item)}
                                                    className="press flex h-14 items-center justify-center rounded-xl p-1 outline-none hover:bg-ink/[0.05] focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-50"
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element -- small SVG thumbnails from our own API */}
                                                    <img src={illustrationUrl(item.id)} alt="" className="h-11 w-11 object-contain" />
                                                </button>
                                            ))}
                                        </div>
                                    </MenuSection>
                                );
                            })}

                        {insertError && <p role="alert" className="type-footnote mt-2 text-fault">{insertError}</p>}
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mb-3 last:mb-0">
            <h3 className="type-caption mb-1.5 px-1 font-semibold uppercase tracking-[0.04em] text-graphite">{title}</h3>
            {children}
        </section>
    );
}
