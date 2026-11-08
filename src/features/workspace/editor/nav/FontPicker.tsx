"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FabricObject, Group } from "fabric";

import useCanvas from "../../canvas/CanvasContext";
import { useEditor } from "../EditorContext";
import { SINGLE_LINE_FONTS, SINGLE_LINE_TEXT_TYPE, getSingleLineFont } from "../../text/fonts";
import { textToPathData } from "../../text/singleLinePath";

type TextObject = FabricObject & { fontFamily: string };

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

/**
 * Font choice for single-line text. Shown while the Text tool is active or
 * text is selected; picking a font sets it for new text and applies it to the
 * selected text.
 */
export function FontPicker() {
    const canvas = useCanvas()?.canvas ?? null;
    const { tool, fontFamily, setFontFamily } = useEditor();

    // Fonts of the currently selected single-line text objects.
    const [selectedFonts, setSelectedFonts] = useState<string[]>([]);

    useEffect(() => {
        if (!canvas) return;

        const sync = () => {
            setSelectedFonts(canvas.getActiveObjects().filter(isSingleLineText).map((text) => text.fontFamily));
        };

        canvas.on("selection:created", sync);
        canvas.on("selection:updated", sync);
        canvas.on("selection:cleared", sync);

        return () => {
            canvas.off("selection:created", sync);
            canvas.off("selection:updated", sync);
            canvas.off("selection:cleared", sync);
        };
    }, [canvas]);

    const visible = tool === "Text" || selectedFonts.length > 0;
    // A mixed selection highlights nothing.
    const current = selectedFonts.length
        ? selectedFonts.every((font) => font === selectedFonts[0]) ? selectedFonts[0] : null
        : fontFamily;

    const applyFont = (id: string) => {
        setFontFamily(id);
        if (!canvas) return;

        const texts = canvas.getActiveObjects().filter(isSingleLineText);
        if (!texts.length) return;

        texts.forEach((text) => {
            text.set("fontFamily", id);
            text.setCoords();
        });

        // A multi-selection must re-measure its bounds around the resized text.
        const active = canvas.getActiveObject();
        if (active && active !== texts[0]) (active as Group).triggerLayout?.();

        canvas.fire("object:modified", { target: active ?? texts[0] });
        canvas.requestRenderAll();
        setSelectedFonts(texts.map(() => id));
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    role="radiogroup"
                    aria-label="Font"
                    className="absolute left-1/2 top-6 z-10 flex gap-1 rounded-lg bg-white p-1 shadow-md"
                    initial={{ opacity: 0, x: "-50%", y: -10 }}
                    animate={{ opacity: 1, x: "-50%", y: 0 }}
                    exit={{ opacity: 0, x: "-50%", y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {PREVIEWS.map(({ id, label, d, width, height }) => {
                        const selected = id === current;

                        return (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={label}
                                title={label}
                                // Keep focus in the text being edited, so it stays in edit mode.
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applyFont(id)}
                                className={`flex h-10 items-center rounded-md px-3 transition-colors duration-300 hover:bg-gray-100 ${
                                    selected ? "bg-gray-100 text-[#1c8096]" : "text-gray-600"
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
                </motion.div>
            )}
        </AnimatePresence>
    );
}
