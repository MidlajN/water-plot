"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "@phosphor-icons/react";
import type { FabricObject, Group } from "fabric";

import useCanvas from "../../canvas/CanvasContext";
import { useEditor } from "../EditorContext";
import { SINGLE_LINE_FONTS, SINGLE_LINE_TEXT_TYPE, getSingleLineFont } from "../../text/fonts";
import { textToPathData } from "../../text/singleLinePath";

type TextObject = FabricObject & { fontFamily: string; fontSize: number };

const isSingleLineText = (object: FabricObject): object is TextObject =>
    object.isType(SINGLE_LINE_TEXT_TYPE);

// Each option shows its label drawn in that font, with the same strokes the pen will draw.
const PREVIEW_FONT_SIZE = 20;
const PREVIEW_PADDING = 4;
const PREVIEWS = SINGLE_LINE_FONTS.map(({ id, label }) => ({
    id,
    label,
    ...textToPathData(getSingleLineFont(id), label, PREVIEW_FONT_SIZE),
}));

/*
 * Sizes are shown in mm (the em height on paper): the canvas is laid out at 96 px per
 * inch, the same scale the SVG export uses for mm.
 */
const PX_PER_MM = 96 / 25.4;
const MIN_SIZE_MM = 2;
const MAX_SIZE_MM = 200;
const toMm = (px: number) => Math.round((px / PX_PER_MM) * 10) / 10;
const clampMm = (mm: number) => Math.min(MAX_SIZE_MM, Math.max(MIN_SIZE_MM, mm));

/** Size the text appears at, including any resizing with its handles. */
const visibleSize = (text: TextObject) => text.fontSize * Math.abs(text.getObjectScaling().y);

/** Keeps focus in the text being edited, so it stays in edit mode. */
const keepFocus = (event: ReactMouseEvent) => event.preventDefault();

/**
 * Font and size for single-line text. Shown while the Text tool is active or text
 * is selected; a choice sets it for new text and applies it to the selected text.
 */
export function FontPicker() {
    const canvas = useCanvas()?.canvas ?? null;
    const { tool, fontFamily, setFontFamily, fontSize, setFontSize } = useEditor();

    // Fonts and visible sizes (px) of the currently selected single-line text objects.
    const [selected, setSelected] = useState<{ fonts: string[]; sizes: number[] }>({ fonts: [], sizes: [] });
    // What is being typed in the size field; null while it just shows the current size.
    const [sizeDraft, setSizeDraft] = useState<string | null>(null);

    useEffect(() => {
        if (!canvas) return;

        const sync = () => {
            const texts = canvas.getActiveObjects().filter(isSingleLineText);
            setSelected({ fonts: texts.map((text) => text.fontFamily), sizes: texts.map(visibleSize) });
        };

        const events = ["selection:created", "selection:updated", "selection:cleared", "object:modified"] as const;
        events.forEach((event) => canvas.on(event, sync));
        return () => events.forEach((event) => canvas.off(event, sync));
    }, [canvas]);

    const visible = tool === "Text" || selected.fonts.length > 0;

    // A mixed selection highlights nothing / leaves the size blank.
    const common = <T,>(values: T[], fallback: T, same: (a: T, b: T) => boolean) =>
        values.length ? (values.every((value) => same(value, values[0])) ? values[0] : null) : fallback;
    const currentFont = common(selected.fonts, fontFamily, (a, b) => a === b);
    const currentSizeMm = common(selected.sizes.map(toMm), toMm(fontSize), (a, b) => a === b);

    /** Applies `apply` to the selected text, then re-measures and records the change. */
    const updateSelection = (apply: (text: TextObject) => void) => {
        if (!canvas) return;

        const texts = canvas.getActiveObjects().filter(isSingleLineText);
        if (!texts.length) return;

        texts.forEach((text) => {
            apply(text);
            text.setCoords();
        });

        // A multi-selection must re-measure its bounds around the resized text.
        const active = canvas.getActiveObject();
        if (active && active !== texts[0]) (active as Group).triggerLayout?.();

        canvas.fire("object:modified", { target: active ?? texts[0] });
        canvas.requestRenderAll();
    };

    const applyFont = (id: string) => {
        setFontFamily(id);
        updateSelection((text) => text.set("fontFamily", id));
    };

    const applySize = (mm: number) => {
        const px = clampMm(mm) * PX_PER_MM;
        setFontSize(px);
        // Keep any handle resizing: set the font size so the visible size matches.
        updateSelection((text) => text.set("fontSize", px / Math.abs(text.getObjectScaling().y)));
    };

    const stepSize = (direction: 1 | -1) => {
        const from = currentSizeMm ?? toMm(selected.sizes[0] ?? fontSize);
        // Whole millimetres: 10.6 steps to 11 or 10.
        const next = direction > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
        setSizeDraft(null);
        applySize(next);
    };

    const onSizeInput = (value: string) => {
        setSizeDraft(value);
        const mm = Number(value);
        // Apply as soon as the value is usable; out-of-range values wait for Enter or blur.
        if (value.trim() !== "" && mm >= MIN_SIZE_MM && mm <= MAX_SIZE_MM) applySize(mm);
    };

    const commitSize = () => {
        if (sizeDraft !== null && sizeDraft.trim() !== "" && Number.isFinite(Number(sizeDraft))) {
            applySize(Number(sizeDraft));
        }
        setSizeDraft(null);
    };

    const stepButton =
        "flex h-10 w-8 items-center justify-center rounded-md text-gray-600 transition-colors duration-300 hover:bg-gray-100 disabled:opacity-40";

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="absolute left-1/2 top-6 z-10 flex items-center gap-1 rounded-lg bg-white p-1 shadow-md"
                    initial={{ opacity: 0, x: "-50%", y: -10 }}
                    animate={{ opacity: 1, x: "-50%", y: 0 }}
                    exit={{ opacity: 0, x: "-50%", y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    <div role="radiogroup" aria-label="Font" className="flex gap-1">
                        {PREVIEWS.map(({ id, label, d, width, height }) => {
                            const isSelected = id === currentFont;

                            return (
                                <button
                                    key={id}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={label}
                                    title={label}
                                    onMouseDown={keepFocus}
                                    onClick={() => applyFont(id)}
                                    className={`flex h-10 items-center rounded-md px-3 transition-colors duration-300 hover:bg-gray-100 ${
                                        isSelected ? "bg-gray-100 text-[#1c8096]" : "text-gray-600"
                                    }`}
                                >
                                    <svg
                                        aria-hidden
                                        width={width + PREVIEW_PADDING * 2}
                                        height={height + PREVIEW_PADDING * 2}
                                        viewBox={`${-PREVIEW_PADDING} ${-PREVIEW_PADDING} ${width + PREVIEW_PADDING * 2} ${height + PREVIEW_PADDING * 2}`}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.25}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d={d} />
                                    </svg>
                                </button>
                            );
                        })}
                    </div>

                    <div aria-hidden className="mx-1 h-6 w-px bg-gray-200" />

                    <div role="group" aria-label="Font size" className="flex items-center">
                        <button
                            type="button"
                            aria-label="Smaller"
                            title="Smaller"
                            onMouseDown={keepFocus}
                            onClick={() => stepSize(-1)}
                            disabled={currentSizeMm !== null && currentSizeMm <= MIN_SIZE_MM}
                            className={stepButton}
                        >
                            <Minus size={14} weight="bold" />
                        </button>
                        <label className="flex h-10 items-center gap-1 rounded-md px-1 text-sm text-gray-600 focus-within:bg-gray-100">
                            <input
                                type="number"
                                inputMode="decimal"
                                aria-label="Font size in millimetres"
                                min={MIN_SIZE_MM}
                                max={MAX_SIZE_MM}
                                step={0.5}
                                placeholder="–"
                                value={sizeDraft ?? (currentSizeMm === null ? "" : String(currentSizeMm))}
                                onChange={(event) => onSizeInput(event.target.value)}
                                onBlur={commitSize}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") event.currentTarget.blur();
                                    if (event.key === "Escape") {
                                        setSizeDraft(null);
                                        event.currentTarget.blur();
                                    }
                                }}
                                className="w-12 bg-transparent text-right tabular-nums text-gray-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <span aria-hidden>mm</span>
                        </label>
                        <button
                            type="button"
                            aria-label="Larger"
                            title="Larger"
                            onMouseDown={keepFocus}
                            onClick={() => stepSize(1)}
                            disabled={currentSizeMm !== null && currentSizeMm >= MAX_SIZE_MM}
                            className={stepButton}
                        >
                            <Plus size={14} weight="bold" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
