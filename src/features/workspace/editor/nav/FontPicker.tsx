"use client";

import { AnimatePresence, motion } from "framer-motion";

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
                    className="absolute left-1/2 top-6 z-10 hidden items-center gap-1 rounded-lg bg-white p-1 shadow-md md:flex"
                    initial={{ opacity: 0, x: "-50%", y: -10 }}
                    animate={{ opacity: 1, x: "-50%", y: 0 }}
                    exit={{ opacity: 0, x: "-50%", y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    <FontOptions style={style} />
                    <div aria-hidden className="mx-1 h-6 w-px bg-gray-200" />
                    <FontSizeControl style={style} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
