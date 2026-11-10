"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { FabricObject } from "fabric";

import useCanvas from "../workspace/canvas/CanvasContext";
import { DEFAULT_STROKE } from "../workspace/canvas/placeOnPage";
import { useEditor } from "../workspace/editor/EditorContext";
import { FontOptions, FontSizeControl, isSingleLineText, useTextStyle } from "../workspace/editor/nav/textStyle";
import type { SingleLineText } from "../workspace/text/SingleLineText";

export interface TextEditorHandle {
    /** Starts editing the selected text, or new text if none is selected. */
    start: () => void;
    /** Ends the edit; empty text is removed. */
    finish: () => void;
}

/**
 * Mobile text input. What is typed appears live as single-line text in the middle of the
 * page (centred on its own middle, so it stays centred as it grows). Tapping text on the
 * canvas loads it here and asks the card to show the Text panel.
 *
 * Undo history gets one entry when the text is created and one when editing ends,
 * not one per keystroke.
 */
export function MobileTextEditor({
    open,
    onRequestOpen,
    ref,
}: {
    /** Whether the Text panel is showing. */
    open: boolean;
    onRequestOpen: () => void;
    ref?: Ref<TextEditorHandle>;
}) {
    const { canvas, workspace } = useCanvas() ?? {};
    const { fontFamily, fontSize, setTool } = useEditor();
    const style = useTextStyle();

    const [value, setValue] = useState("");
    const textRef = useRef<SingleLineText | null>(null);
    const textClassRef = useRef<typeof SingleLineText | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        void import("../workspace/text/SingleLineText").then((module) => {
            textClassRef.current = module.SingleLineText;
        });
    }, []);

    /** The text being edited, if it is still on the canvas (undo can replace it). */
    const currentText = () => {
        const text = textRef.current;
        return text && canvas?.getObjects().includes(text) ? text : null;
    };

    /** Records the current text in the undo history. */
    const checkpoint = () => {
        const text = currentText();
        if (text && text.text.trim()) canvas?.fire("object:modified", { target: text });
    };

    const finish = () => {
        const text = currentText();
        if (canvas && text) {
            if (!text.text.trim()) canvas.remove(text);
            else checkpoint();
            canvas.requestRenderAll();
        }
        textRef.current = null;
        setValue("");
    };

    const startEditing = (text: SingleLineText | null) => {
        textRef.current = text;
        setValue(text?.text ?? "");
        setTool("Select");
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    useImperativeHandle(ref, () => ({
        start: () => {
            const selected = canvas?.getActiveObject();
            startEditing(selected && isSingleLineText(selected) ? (selected as SingleLineText) : null);
        },
        finish,
    }));

    const onInput = (next: string) => {
        setValue(next);
        if (!canvas || !workspace) return;

        let text = currentText();
        if (!text) {
            const TextClass = textClassRef.current;
            if (!TextClass || !next.trim()) return;

            const centre = workspace.getWorkspace().getCenterPoint();
            text = new TextClass(next, {
                left: centre.x,
                top: centre.y,
                originX: "center",
                originY: "center",
                fontFamily,
                fontSize,
                stroke: DEFAULT_STROKE,
            });
            textRef.current = text;
            canvas.add(text);
            canvas.setActiveObject(text);
        } else {
            text.set("text", next);
            text.setCoords();
        }
        canvas.requestRenderAll();
    };

    // Keep the editor in step with the canvas: tapping text loads it (and opens the Text
    // panel), tapping elsewhere ends the edit, and Fabric's own on-canvas editing is
    // redirected to this field.
    useEffect(() => {
        if (!canvas) return;

        const onSelection = () => {
            const selected = canvas.getActiveObjects();
            const single = selected.length === 1 ? (selected[0] as FabricObject) : null;
            if (single && single === textRef.current) return;

            if (single && isSingleLineText(single)) {
                if (textRef.current) finish();
                startEditing(single as SingleLineText);
                onRequestOpen();
            } else if (textRef.current) {
                finish();
            }
        };

        const onEditingEntered = ({ target }: { target: FabricObject }) => {
            (target as SingleLineText).exitEditing();
            if (target !== textRef.current) startEditing(target as SingleLineText);
            onRequestOpen();
        };

        const onRemoved = ({ target }: { target: FabricObject }) => {
            if (target === textRef.current) {
                textRef.current = null;
                setValue("");
            }
        };

        canvas.on("selection:created", onSelection);
        canvas.on("selection:updated", onSelection);
        canvas.on("selection:cleared", onSelection);
        canvas.on("text:editing:entered", onEditingEntered);
        canvas.on("object:removed", onRemoved);
        return () => {
            canvas.off("selection:created", onSelection);
            canvas.off("selection:updated", onSelection);
            canvas.off("selection:cleared", onSelection);
            canvas.off("text:editing:entered", onEditingEntered);
            canvas.off("object:removed", onRemoved);
        };
        // finish/startEditing only touch refs and stable setters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvas, onRequestOpen]);

    if (!open) return null;

    return (
        <div className="space-y-2">
            <textarea
                ref={inputRef}
                value={value}
                onChange={(event) => onInput(event.target.value)}
                onBlur={checkpoint}
                rows={2}
                placeholder="Type your text…"
                aria-label="Text to plot"
                className="focus-ring w-full resize-none rounded-control border border-line bg-surface-sunken px-3 py-2 text-base text-text transition-[border-color,background-color] duration-150 focus:border-accent-line focus:bg-surface-raised"
            />
            <div className="flex items-center gap-2">
                <FontOptions style={style} className="min-w-0 flex-1 overflow-x-auto" />
                <FontSizeControl style={style} className="shrink-0" />
            </div>
        </div>
    );
}
