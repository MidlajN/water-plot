"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
    ILLUSTRATION_CATEGORIES,
    illustrationUrl,
    useIllustrations,
    useInsertIllustration,
} from "@/features/illustrations/useIllustrations";
import type { Illustration } from "@/features/illustrations/library";
import { useEditor, type DrawingElement } from "../EditorContext";
import { SHAPES } from "./shapes";
import { ACTIVE_COLOR, IDLE_COLOR, ToolTooltip, toolButtonClass } from "./toolbar";

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
                className={toolButtonClass(highlighted)}
            >
                {current.icon(highlighted ? ACTIVE_COLOR : IDLE_COLOR)}
            </button>
            <ToolTooltip label="Elements" hidden={open} />

            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        aria-label="Elements"
                        className="absolute left-full top-0 z-20 ml-3 max-h-[70vh] w-72 overflow-y-auto rounded-lg bg-white p-3 shadow-md"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
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
                                            className={`flex h-12 items-center justify-center rounded-md transition-colors hover:bg-gray-100 ${selected ? "bg-gray-100" : ""}`}
                                        >
                                            {shape.icon(selected ? ACTIVE_COLOR : IDLE_COLOR)}
                                        </button>
                                    );
                                })}
                            </div>
                        </MenuSection>

                        {library.status === "loading" && <p className="py-4 text-center text-sm text-gray-500">Loading illustrations…</p>}

                        {library.status === "error" && (
                            <p className="py-4 text-center text-sm text-gray-600">
                                Couldn&apos;t load illustrations.{" "}
                                <button type="button" onClick={() => void loadLibrary()} className="font-medium text-[#1c8096] underline">
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
                                                    className="flex h-14 items-center justify-center rounded-md p-1 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element -- small SVG thumbnails from our own API */}
                                                    <img src={illustrationUrl(item.id)} alt="" className="h-11 w-11 object-contain" />
                                                </button>
                                            ))}
                                        </div>
                                    </MenuSection>
                                );
                            })}

                        {insertError && <p role="alert" className="mt-2 text-sm text-red-600">{insertError}</p>}
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mb-3 last:mb-0">
            <h3 className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-gray-500">{title}</h3>
            {children}
        </section>
    );
}
