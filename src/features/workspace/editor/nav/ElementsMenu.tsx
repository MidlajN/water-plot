"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { Illustration, IllustrationCategory } from "@/features/illustrations/library";
import useCanvas from "../../canvas/CanvasContext";
import { addSvgToPage } from "../../canvas/insertSvg";
import { useEditor, type DrawingElement } from "../EditorContext";
import { CircleIcon, LineIcon, RectIcon, TriangleIcon } from "./icons";
import { ACTIVE_COLOR, IDLE_COLOR, ToolTooltip, toolButtonClass } from "./toolbar";

const SHAPES: { element: DrawingElement; label: string; icon: (color: string) => ReactNode }[] = [
    { element: "line", label: "Line", icon: (color) => <LineIcon width={30} height={25} strokeWidth={2} color={color} /> },
    { element: "rectangle", label: "Rectangle", icon: (color) => <RectIcon width={25} height={25} strokeWidth={1.5} color={color} /> },
    { element: "circle", label: "Circle", icon: (color) => <CircleIcon width={28} height={25} strokeWidth={1.5} color={color} /> },
    { element: "triangle", label: "Triangle", icon: (color) => <TriangleIcon width={18} height={25} strokeWidth={1.5} color={color} /> },
];

const CATEGORIES: { id: IllustrationCategory; label: string }[] = [
    { id: "characters", label: "Characters" },
    { id: "decorative", label: "Decorative" },
];

type LibraryState =
    | { status: "idle" | "loading" | "error" }
    | { status: "ready"; illustrations: Illustration[] };

/**
 * Elements button: opens a dropdown with the drawing shapes and the illustration
 * library (served by /api/illustrations). Picking a shape arms the Elements tool;
 * picking an illustration places it in the middle of the page.
 */
export function ElementsMenu() {
    const { tool, element, setTool, setElement } = useEditor();
    const canvasContext = useCanvas();
    const [open, setOpen] = useState(false);
    const [library, setLibrary] = useState<LibraryState>({ status: "idle" });
    const [inserting, setInserting] = useState<string | null>(null);
    const [insertError, setInsertError] = useState<string | null>(null);
    const containerRef = useRef<HTMLLIElement>(null);

    const active = tool === "Elements";
    const current = SHAPES.find((shape) => shape.element === element) ?? SHAPES[1];

    const loadLibrary = async () => {
        setLibrary({ status: "loading" });
        try {
            const response = await fetch("/api/illustrations");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const { illustrations } = (await response.json()) as { illustrations: Illustration[] };
            setLibrary({ status: "ready", illustrations });
        } catch (error) {
            console.error("Unable to load illustrations:", error);
            setLibrary({ status: "error" });
        }
    };

    const toggle = () => {
        if (!open && (library.status === "idle" || library.status === "error")) void loadLibrary();
        setInsertError(null);
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
        const { canvas, workspace } = canvasContext ?? {};
        if (!canvas || !workspace || inserting) return;

        setInserting(illustration.id);
        setInsertError(null);
        setTool("Select");
        try {
            const response = await fetch(`/api/illustrations/${encodeURIComponent(illustration.id)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await addSvgToPage(canvas, workspace, await response.text());
            setOpen(false);
        } catch (error) {
            console.error(`Unable to insert ${illustration.name}:`, error);
            setInsertError(`Couldn't add ${illustration.name}. Try again.`);
        } finally {
            setInserting(null);
        }
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
                            CATEGORIES.map(({ id, label }) => {
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
                                                    <img src={`/api/illustrations/${encodeURIComponent(item.id)}`} alt="" className="h-11 w-11 object-contain" />
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
