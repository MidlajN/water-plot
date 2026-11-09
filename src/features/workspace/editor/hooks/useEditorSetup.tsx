"use client";
/* eslint-disable react-hooks/immutability -- this hook drives the imperative Fabric canvas from context by design. */

import { useEffect, useRef } from "react";
import type { Canvas, FabricObject } from "fabric";

import useCanvas from "../../canvas/CanvasContext";
import { useEditor } from "../EditorContext";

type PointerInfo = {
    e: MouseEvent | TouchEvent;
};

type WorkspaceHistory = {
    eventHandlers?: {
        saveState?: (...args: never[]) => void;
    };
};

const DEFAULT_STROKE = "#111111";
const PROTECTED_OBJECT_NAMES = ["workspace", "BedSize", "ToolHead"];

const isLeftClickOrTouch = (event: PointerInfo) =>
    !(event.e instanceof MouseEvent) || event.e.button === 0;

export function useEditorSetup() {
    const canvasContext = useCanvas();
    const { tool, element, fontFamily, fontSize, setTool } = useEditor();

    const canvas = canvasContext?.canvas ?? null;
    const workspace = canvasContext?.workspace ?? null;
    const toolRef = canvasContext?.toolRef;

    // Read through refs so changing font or size mid-edit does not restart the tool and end editing.
    const fontFamilyRef = useRef(fontFamily);
    useEffect(() => {
        fontFamilyRef.current = fontFamily;
    }, [fontFamily]);
    const fontSizeRef = useRef(fontSize);
    useEffect(() => {
        fontSizeRef.current = fontSize;
    }, [fontSize]);

    // Keep the Fabric tool behavior synchronized with editor state.
    useEffect(() => {
        if (!canvas) return;

        let disposed = false;
        let cleanupTool = () => {};

        const previousSelectability = new Map<FabricObject, boolean>();

        // Shapes are added while dragging; history is paused so only the finished shape is saved.
        const saveState = (workspace as unknown as WorkspaceHistory | null)?.eventHandlers?.saveState;
        let historyPaused = false;

        const pauseHistory = () => {
            if (!saveState || historyPaused) return;
            canvas.off("object:added", saveState as never);
            historyPaused = true;
        };

        const resumeHistory = () => {
            if (!saveState || !historyPaused) return;
            canvas.on("object:added", saveState as never);
            historyPaused = false;
        };

        const disableObjectSelection = () => {
            canvas.discardActiveObject();
            canvas.selection = false;

            canvas.getObjects().forEach((object) => {
                if (PROTECTED_OBJECT_NAMES.includes(String(object.get("name") ?? ""))) return;

                if (!previousSelectability.has(object)) {
                    previousSelectability.set(object, object.selectable);
                }
                object.set({ selectable: false });
            });
        };

        const restoreObjectSelection = () => {
            const objects = canvas.getObjects();
            previousSelectability.forEach((selectable, object) => {
                if (objects.includes(object)) object.set({ selectable });
            });
            previousSelectability.clear();
        };

        const commonSetup = (cursor: string) => {
            disableObjectSelection();
            canvas.defaultCursor = cursor;
            canvas.hoverCursor = cursor;
        };

        const resetCanvas = () => {
            cleanupTool();
            cleanupTool = () => {};
            resumeHistory();

            canvas.isDrawingMode = false;
            canvas.selection = true;
            canvas.defaultCursor = "default";
            canvas.hoverCursor = "move";

            restoreObjectSelection();
            canvas.requestRenderAll();
        };

        /** Mouse handlers for tools that drag out a new object. */
        const registerDragTool = (handlers: {
            down: (event: PointerInfo) => void;
            move: (event: PointerInfo) => void;
            up: () => void;
            cleanup: () => void;
        }) => {
            canvas.on("mouse:down", handlers.down);
            canvas.on("mouse:move", handlers.move);
            canvas.on("mouse:up", handlers.up);

            cleanupTool = () => {
                canvas.off("mouse:down", handlers.down);
                canvas.off("mouse:move", handlers.move);
                canvas.off("mouse:up", handlers.up);
                handlers.cleanup();
                resumeHistory();
            };
        };

        /** Keeps a finished shape, or drops it if it was only a click. */
        const finishShape = (shape: FabricObject, isDot: boolean) => {
            if (isDot) {
                canvas.remove(shape);
            } else {
                shape.set({ selectable: true });
                shape.setCoords();
                canvas.fire("object:modified", { target: shape });
            }
            resumeHistory();
            canvas.requestRenderAll();
        };

        // The workspace plugin reads the active tool from toolRef and the legacy canvas.mode.
        // The previous tool's cleanup (resetCanvas) already left the canvas in Select state.
        if (toolRef) toolRef.current = tool;
        (canvas as Canvas & { mode?: string }).mode = tool;

        const setup = async () => {
            // Fabric touches browser globals, so it is only imported after mount.
            const [{ Line, PencilBrush, Rect, Ellipse, Triangle }, { SingleLineText }] =
                await Promise.all([import("fabric"), import("../../text/SingleLineText")]);

            if (disposed) return;

            /* ---------------------------------------
             * PEN TOOL
             * ------------------------------------- */

            if (tool === "Pen") {
                const brush = new PencilBrush(canvas);
                brush.color = DEFAULT_STROKE;
                brush.width = 2;

                canvas.freeDrawingBrush = brush;
                canvas.freeDrawingCursor = "crosshair";
                canvas.isDrawingMode = true;

                const handlePathCreated = (event: { path: FabricObject }) => {
                    (event.path as FabricObject & { isFreeDraw?: boolean }).isFreeDraw = true;
                };

                canvas.on("path:created", handlePathCreated);

                cleanupTool = () => {
                    canvas.isDrawingMode = false;
                    canvas.off("path:created", handlePathCreated);
                };
                return;
            }

            /* ---------------------------------------
             * ELEMENTS TOOL: LINE
             * ------------------------------------- */

            if (tool === "Elements" && element === "line") {
                commonSetup("crosshair");

                let line: InstanceType<typeof Line> | null = null;

                registerDragTool({
                    down: (event) => {
                        if (!isLeftClickOrTouch(event)) return;
                        pauseHistory();

                        const pointer = canvas.getPointer(event.e);
                        line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                            id: "added-line",
                            stroke: DEFAULT_STROKE,
                            strokeWidth: 2,
                            selectable: false,
                        });
                        canvas.add(line);
                        canvas.requestRenderAll();
                    },
                    move: (event) => {
                        if (!line) return;
                        const pointer = canvas.getPointer(event.e);

                        // Hold Ctrl to constrain the line to a horizontal or vertical axis.
                        if (event.e instanceof MouseEvent && event.e.ctrlKey) {
                            const dx = Math.abs(pointer.x - line.x1);
                            const dy = Math.abs(pointer.y - line.y1);
                            if (dx >= dy) pointer.y = line.y1;
                            else pointer.x = line.x1;
                        }

                        line.set({ x2: pointer.x, y2: pointer.y });
                        canvas.requestRenderAll();
                    },
                    up: () => {
                        if (!line) return resumeHistory();
                        const isDot = Math.abs(line.x1 - line.x2) < 1 && Math.abs(line.y1 - line.y2) < 1;
                        finishShape(line, isDot);
                        line = null;
                    },
                    cleanup: () => {
                        if (line) canvas.remove(line);
                        line = null;
                    },
                });
                return;
            }

            /* ---------------------------------------
             * ELEMENTS TOOL: SHAPES
             * ------------------------------------- */

            if (tool === "Elements") {
                commonSetup("crosshair");

                let shape: FabricObject | null = null;
                let start = { x: 0, y: 0 };

                registerDragTool({
                    down: (event) => {
                        if (!isLeftClickOrTouch(event)) return;
                        pauseHistory();

                        start = canvas.getPointer(event.e);
                        const options = {
                            left: start.x,
                            top: start.y,
                            fill: "transparent",
                            stroke: DEFAULT_STROKE,
                            strokeWidth: 2,
                            selectable: false,
                        };

                        if (element === "rectangle") shape = new Rect({ ...options, width: 0, height: 0 });
                        else if (element === "circle") shape = new Ellipse({ ...options, rx: 0, ry: 0 });
                        else if (element === "triangle") shape = new Triangle({ ...options, width: 0, height: 0 });

                        if (shape) canvas.add(shape);
                    },
                    move: (event) => {
                        if (!shape) return;
                        const pointer = canvas.getPointer(event.e);
                        const width = Math.abs(pointer.x - start.x);
                        const height = Math.abs(pointer.y - start.y);
                        const left = Math.min(pointer.x, start.x);
                        const top = Math.min(pointer.y, start.y);

                        shape.set(
                            element === "circle"
                                ? { left, top, rx: width / 2, ry: height / 2 }
                                : { left, top, width, height }
                        );
                        canvas.requestRenderAll();
                    },
                    up: () => {
                        if (!shape) return resumeHistory();
                        const bounds = shape.getBoundingRect();
                        finishShape(shape, bounds.width < 1 || bounds.height < 1);
                        shape = null;
                    },
                    cleanup: () => {
                        if (shape) canvas.remove(shape);
                        shape = null;
                    },
                });
                return;
            }

            /* ---------------------------------------
             * TEXT TOOL
             * ------------------------------------- */

            if (tool === "Text") {
                commonSetup("text");

                // Clicking to leave edit mode must not immediately start another text box.
                let allowNewText = true;
                let reenableTimeout: ReturnType<typeof setTimeout> | undefined;

                const removeIfEmpty = (object: FabricObject | undefined) => {
                    if (object instanceof SingleLineText && !object.text.trim()) {
                        canvas.remove(object);
                    }
                };

                const handleMouseDown = (event: PointerInfo) => {
                    if (!allowNewText || !isLeftClickOrTouch(event)) return;

                    const pointer = canvas.getPointer(event.e);
                    const onExistingText = canvas
                        .getObjects()
                        .some((object) => object instanceof SingleLineText && object.containsPoint(pointer));
                    if (onExistingText) return;

                    allowNewText = false;

                    const text = new SingleLineText("", {
                        left: pointer.x,
                        top: pointer.y,
                        fontFamily: fontFamilyRef.current,
                        fontSize: fontSizeRef.current,
                        stroke: DEFAULT_STROKE,
                    });

                    canvas.add(text);
                    canvas.setActiveObject(text);
                    text.enterEditing();
                    canvas.requestRenderAll();
                };

                const handleEditingExited = (event: { target?: FabricObject }) => {
                    removeIfEmpty(event.target);

                    if (reenableTimeout) clearTimeout(reenableTimeout);
                    reenableTimeout = setTimeout(() => {
                        allowNewText = true;
                    }, 200);
                };

                canvas.on("mouse:down", handleMouseDown);
                canvas.on("text:editing:exited", handleEditingExited);

                cleanupTool = () => {
                    canvas.off("mouse:down", handleMouseDown);
                    canvas.off("text:editing:exited", handleEditingExited);
                    if (reenableTimeout) clearTimeout(reenableTimeout);

                    const active = canvas.getActiveObject();
                    if (active instanceof SingleLineText && active.isEditing) {
                        active.exitEditing();
                        removeIfEmpty(active);
                        canvas.discardActiveObject();
                    }
                };
                return;
            }

            // Select is the default state, already restored by resetCanvas.
        };

        setup().catch((error: unknown) => {
            if (!disposed) console.error("Unable to initialize editor tool:", error);
        });

        return () => {
            disposed = true;
            resetCanvas();
        };
    }, [canvas, workspace, toolRef, tool, element]);

    // Escape always switches back to Select.
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setTool("Select");
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [setTool]);
}
