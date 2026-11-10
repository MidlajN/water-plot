"use client";

import { AnimatePresence, motion } from "framer-motion";

import { DURATION, EASE_IN, EASE_OUT } from "@/lib/motion";
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

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="glass absolute top-8 left-1/2 z-10 hidden items-center gap-1 rounded-panel border border-line p-1 shadow-raised md:flex"
                    initial={{ opacity: 0, x: "-50%", y: -6 }}
                    animate={{ opacity: 1, x: "-50%", y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } }}
                    exit={{ opacity: 0, x: "-50%", y: -4, transition: { duration: DURATION.fast, ease: EASE_IN } }}
                >
                    <FontOptions style={style} />
                    <div aria-hidden className="mx-1 h-6 w-px bg-line" />
                    <FontSizeControl style={style} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
