"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Canvas as FabricCanvas, FabricObject, Point } from "fabric";

import useCanvas, { type WorkspaceInstance } from "../workspace/canvas/CanvasContext";

/*
 * Floating joystick for moving the selected object on touch screens, where dragging a
 * small object on a small canvas is fiddly.
 *
 * - Push the knob: the selection glides in that direction, faster the further you push.
 * - Double-tap the knob: a sector picker opens (the page split into a 3×3 grid of 9
 *   sectors). Keep the second tap down, or press again, push the knob towards an outer
 *   sector and let go to drop the selection in the middle of it. For the centre sector,
 *   tap the knob once more (press and let go without pushing). Letting go of the
 *   double-tap itself without pushing keeps the picker open. You can also tap a sector
 *   in the panel, or × to cancel.
 */

const KNOB_TRAVEL = 34; // px the knob can move from the centre
const DEADZONE = 0.12; // share of travel ignored, so a resting thumb doesn't drift
const TAP_STILL = 0.25; // a press that pushes further than this is not a tap
const TAP_MS = 300; // longest press that still counts as a tap
const DOUBLE_TAP_MS = 350; // longest gap between the two taps
const PICK_THRESHOLD = 0.45; // push at least this far to point at a sector
/** Top speed, in page widths (shorter side) per second. */
const MAX_SPEED = 0.6;

type Sector = "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";

/** Grid cell (column, row) of each sector. */
const SECTOR_CELLS: Record<Sector, [number, number]> = {
    nw: [0, 0], n: [1, 0], ne: [2, 0],
    w: [0, 1], c: [1, 1], e: [2, 1],
    sw: [0, 2], s: [1, 2], se: [2, 2],
};
const SECTOR_LABELS: Record<Sector, string> = {
    nw: "Top left", n: "Top", ne: "Top right",
    w: "Left", c: "Centre", e: "Right",
    sw: "Bottom left", s: "Bottom", se: "Bottom right",
};
/** Clockwise from "right", matching angles from atan2 with y pointing down. */
const SECTORS_BY_ANGLE: Sector[] = ["e", "se", "s", "sw", "w", "nw", "n", "ne"];
const GRID: Sector[] = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"];

/**
 * The sector the knob points at: an outer one when pushed, the centre when resting.
 * `centreAllowed` is false for the press that opened the picker, so letting go of the
 * double-tap without pushing doesn't immediately pick the centre.
 */
function sectorFor(x: number, y: number, centreAllowed: boolean): Sector | null {
    if (Math.hypot(x, y) < PICK_THRESHOLD) return centreAllowed ? "c" : null;
    const step = Math.round(Math.atan2(y, x) / (Math.PI / 4));
    return SECTORS_BY_ANGLE[(step + 8) % 8];
}

/** The page rectangle in canvas (scene) coordinates. */
function pageRect(workspace: WorkspaceInstance) {
    const page = workspace.getWorkspace();
    return { left: page.left, top: page.top, width: page.width * page.scaleX, height: page.height * page.scaleY };
}

/** Moves `object`'s centre to (x, y), kept inside the page when it fits. */
function moveCentreTo(object: FabricObject, workspace: WorkspaceInstance, x: number, y: number, PointClass: typeof Point) {
    const page = pageRect(workspace);
    const bounds = object.getBoundingRect();
    const clamp = (value: number, start: number, length: number, size: number) =>
        size >= length ? start + length / 2 : Math.min(start + length - size / 2, Math.max(start + size / 2, value));

    object.setPositionByOrigin(
        new PointClass(clamp(x, page.left, page.width, bounds.width), clamp(y, page.top, page.height, bounds.height)),
        "center",
        "center",
    );
    object.setCoords();
}

function placeInSector(canvas: FabricCanvas, workspace: WorkspaceInstance, sector: Sector, PointClass: typeof Point) {
    const object = canvas.getActiveObject();
    if (!object) return;
    const page = pageRect(workspace);
    const [column, row] = SECTOR_CELLS[sector];
    moveCentreTo(object, workspace, page.left + ((column + 0.5) * page.width) / 3, page.top + ((row + 0.5) * page.height) / 3, PointClass);
    canvas.fire("object:modified", { target: object });
    canvas.requestRenderAll();
}

export function Joystick() {
    const { canvas, workspace, containerRef } = useCanvas() ?? {};
    const [hasSelection, setHasSelection] = useState(false);
    const [pickerRequested, setPickerOpen] = useState(false);
    const [pointed, setPointed] = useState<Sector | null>(null);
    const pickerOpen = pickerRequested && hasSelection;
    const [pageBox, setPageBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

    const knobRef = useRef<HTMLDivElement>(null);
    const pointClassRef = useRef<typeof Point | null>(null);
    const drag = useRef({
        pointerId: -1,
        centre: { x: 0, y: 0 },
        vector: { x: 0, y: 0 },
        moved: false, // pushed past TAP_STILL during this press
        glided: false, // the selection moved during this press
        frame: 0,
        lastTime: 0,
        pressStart: 0,
        openedPicker: false, // this press opened the picker (second tap of a double-tap)
        lastTapEnd: 0, // when the previous tap ended, for double-tap detection
    });
    // Pointer handlers and the animation loop read the latest picker state through a ref.
    const pickerOpenRef = useRef(false);
    useEffect(() => {
        pickerOpenRef.current = pickerOpen;
    }, [pickerOpen]);

    useEffect(() => {
        void import("fabric").then(({ Point }) => {
            pointClassRef.current = Point;
        });
    }, []);

    // Enabled only while something is selected.
    useEffect(() => {
        if (!canvas) return;
        const sync = () => {
            const selected = Boolean(canvas.getActiveObject());
            setHasSelection(selected);
            if (!selected) setPickerOpen(false);
        };
        sync();
        const events = ["selection:created", "selection:updated", "selection:cleared"] as const;
        events.forEach((event) => canvas.on(event, sync));
        return () => events.forEach((event) => canvas.off(event, sync));
    }, [canvas]);

    /** Opens the sector picker, measuring where the page is on screen for the overlay. */
    const openPicker = () => {
        if (canvas && workspace && containerRef?.current) {
            // The view is locked to fit, so the page doesn't move while the picker is open.
            const page = pageRect(workspace);
            const [scaleX, , , scaleY, offsetX, offsetY] = canvas.viewportTransform;
            const box = containerRef.current.getBoundingClientRect();
            setPageBox({
                left: box.left + page.left * scaleX + offsetX,
                top: box.top + page.top * scaleY + offsetY,
                width: page.width * scaleX,
                height: page.height * scaleY,
            });
        }
        setPointed(null);
        setPickerOpen(true);
        pickerOpenRef.current = true; // before the re-render, so this press can already pick
        navigator.vibrate?.(20);
    };

    /** Glides the selection while the knob is pushed. */
    const tick = (time: number) => {
        const state = drag.current;
        const dt = state.lastTime ? Math.min(0.05, (time - state.lastTime) / 1000) : 0;
        state.lastTime = time;

        const object = canvas?.getActiveObject();
        const PointClass = pointClassRef.current;
        const strength = Math.hypot(state.vector.x, state.vector.y);
        if (canvas && workspace && object && PointClass && !pickerOpenRef.current && strength > DEADZONE && dt > 0) {
            const page = pageRect(workspace);
            // Ease in: small pushes give fine control, full pushes move quickly.
            const speed = MAX_SPEED * Math.min(page.width, page.height) * ((strength - DEADZONE) / (1 - DEADZONE)) ** 2;
            const centre = object.getCenterPoint();
            moveCentreTo(
                object,
                workspace,
                centre.x + (state.vector.x / strength) * speed * dt,
                centre.y + (state.vector.y / strength) * speed * dt,
                PointClass,
            );
            canvas.requestRenderAll();
            state.glided = true;
        }
        state.frame = requestAnimationFrame(tick);
    };

    const setKnob = (x: number, y: number) => {
        if (knobRef.current) knobRef.current.style.transform = `translate(${x * KNOB_TRAVEL}px, ${y * KNOB_TRAVEL}px)`;
    };

    function stopPress() {
        const state = drag.current;
        cancelAnimationFrame(state.frame);
        state.pointerId = -1;
        state.vector = { x: 0, y: 0 };
        state.lastTime = 0;
        setKnob(0, 0);
    }

    // Stop the loop if the joystick goes away mid-press.
    useEffect(() => () => cancelAnimationFrame(drag.current.frame), []);

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!hasSelection || drag.current.pointerId !== -1) return;
        try {
            // Keep receiving moves when the thumb slides off the joystick.
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Not an active pointer (e.g. a synthetic event); moves still arrive while over it.
        }
        const box = event.currentTarget.getBoundingClientRect();

        const state = drag.current;
        state.pointerId = event.pointerId;
        state.centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        state.moved = false;
        state.glided = false;
        state.pressStart = event.timeStamp;
        state.openedPicker = false;
        state.frame = requestAnimationFrame(tick);

        // Second tap of a double-tap: open the sector picker.
        if (!pickerOpenRef.current && state.lastTapEnd && event.timeStamp - state.lastTapEnd < DOUBLE_TAP_MS) {
            state.lastTapEnd = 0;
            state.openedPicker = true;
            openPicker();
        } else if (pickerOpenRef.current) {
            setPointed("c");
        }
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const state = drag.current;
        if (event.pointerId !== state.pointerId) return;

        let x = (event.clientX - state.centre.x) / KNOB_TRAVEL;
        let y = (event.clientY - state.centre.y) / KNOB_TRAVEL;
        const length = Math.hypot(x, y);
        if (length > 1) {
            x /= length;
            y /= length;
        }
        state.vector = { x, y };
        setKnob(x, y);

        if (Math.hypot(x, y) > TAP_STILL) state.moved = true;
        if (pickerOpenRef.current) setPointed(sectorFor(x, y, !state.openedPicker));
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        const state = drag.current;
        if (event.pointerId !== state.pointerId) return;
        const { x, y } = state.vector;
        const glided = state.glided;
        const centreAllowed = !state.openedPicker;
        const wasTap = !state.moved && event.timeStamp - state.pressStart < TAP_MS;
        state.lastTapEnd = wasTap ? event.timeStamp : 0;
        stopPress();

        if (pickerOpenRef.current) {
            const sector = sectorFor(x, y, centreAllowed);
            if (sector) choose(sector);
            else setPointed(null);
            return;
        }
        // One undo step per push.
        const object = canvas?.getActiveObject();
        if (glided && canvas && object) canvas.fire("object:modified", { target: object });
    };

    const choose = (sector: Sector) => {
        if (canvas && workspace && pointClassRef.current) placeInSector(canvas, workspace, sector, pointClassRef.current);
        setPickerOpen(false);
        pickerOpenRef.current = false;
        setPointed(null);
    };

    return (
        <>
            {/* Sector overlay on the page while choosing. */}
            {pickerOpen && pageBox && (
                <div
                    aria-hidden
                    className="pointer-events-none fixed z-20 grid grid-cols-3 grid-rows-3"
                    style={{ left: pageBox.left, top: pageBox.top, width: pageBox.width, height: pageBox.height }}
                >
                    {GRID.map((sector) => (
                        <div
                            key={sector}
                            className={`border border-dashed border-teal/40 transition-colors ${sector === pointed ? "bg-teal/20" : ""}`}
                        />
                    ))}
                </div>
            )}

            <div className="fixed bottom-[calc(50dvh+16px)] right-4 z-30 flex items-end gap-2">
                <AnimatePresence>
                    {pickerOpen && (
                        <motion.div
                            role="dialog"
                            aria-label="Move to sector"
                            className="material-float w-36 origin-right rounded-2xl p-1.5"
                            initial={{ opacity: 0, x: 8, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                        >
                            <div className="flex items-center justify-between gap-1 pb-1 pl-1">
                                <p className="type-caption truncate font-semibold text-graphite">
                                    {pointed ? SECTOR_LABELS[pointed] : "Pick a sector"}
                                </p>
                                <button
                                    type="button"
                                    aria-label="Cancel"
                                    onClick={() => setPickerOpen(false)}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base leading-none text-graphite active:bg-black/[0.06]"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                {GRID.map((sector) => (
                                    <button
                                        key={sector}
                                        type="button"
                                        aria-label={`Move to ${SECTOR_LABELS[sector].toLowerCase()}`}
                                        onClick={() => choose(sector)}
                                        className={`h-6 rounded-md transition-colors ${sector === pointed ? "bg-teal" : "bg-black/[0.06] active:bg-black/[0.1]"}`}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div
                    role="group"
                    aria-label="Move selection joystick. Double-tap to pick one of 9 sectors."
                    aria-disabled={!hasSelection}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className={`material-float relative flex h-24 w-24 touch-none select-none items-center justify-center rounded-full transition-opacity ${
                        pickerOpen ? "ring-2 ring-teal" : ""
                    } ${hasSelection ? "opacity-100" : "opacity-45"}`}
                >
                    {/* Direction ticks */}
                    {["top-1.5 left-1/2 -translate-x-1/2", "bottom-1.5 left-1/2 -translate-x-1/2", "left-1.5 top-1/2 -translate-y-1/2", "right-1.5 top-1/2 -translate-y-1/2"].map(
                        (position) => (
                            <span key={position} aria-hidden className={`absolute h-1.5 w-1.5 rounded-full bg-black/15 ${position}`} />
                        ),
                    )}
                    <div
                        ref={knobRef}
                        aria-hidden
                        className={`h-11 w-11 rounded-full shadow-[0_2px_8px_rgb(0_0_0/0.25)] transition-[background-color] ${pickerOpen ? "bg-teal" : "bg-ink"}`}
                    />
                </div>
            </div>
        </>
    );
}
