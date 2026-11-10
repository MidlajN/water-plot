"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useEditor } from "../EditorContext";
import { FontOptions, FontSizeControl, useTextStyle } from "./textStyle";

/**
 * Desktop font and size picker for single-line text. Shown while the Text tool is active
 * or text is selected; a choice sets it for new text and applies it to the selected text.
 */
export function FontPicker() {
    const { tool } = useEditor();
    const style = useTextStyle();
    const visible = tool === "Text" || style.selectedCount > 0;
    const reduceMotion = useReducedMotion();

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="material-float absolute left-1/2 top-4 z-10 hidden origin-top items-center gap-1 rounded-2xl p-1 md:flex"
                    initial={reduceMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: -8, scale: 0.97 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                >
                    <FontOptions style={style} />
                    <div aria-hidden className="mx-1 h-6 w-px bg-separator" />
                    <FontSizeControl style={style} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
