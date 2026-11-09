"use client";

import type { Canvas as FabricCanvas, FabricObject } from "fabric";

import type { WorkspaceInstance } from "./CanvasContext";
import type { DrawingElement } from "../editor/EditorContext";

export const DEFAULT_STROKE = "#111111";

/**
 * Adds `object` to the middle of the page with its longer side at `share` of the page's
 * shorter side, and selects it.
 */
export function placeAtPageCentre(canvas: FabricCanvas, workspace: WorkspaceInstance, object: FabricObject, share: number) {
    const page = workspace.getWorkspace();
    const target = Math.min(page.width * page.scaleX, page.height * page.scaleY) * share;
    const size = Math.max(object.width, object.height);
    if (size > 0) object.scale(target / size);
    object.setPositionByOrigin(page.getCenterPoint(), "center", "center");
    object.setCoords();

    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    return object;
}

/** Share of the page's shorter side an inserted shape takes up. */
const SHAPE_SIZE = 0.25;
/** Shapes are built at this size and scaled to fit, so the stroke stays 2 px. */
const BASE = 100;

/** Adds a medium-sized shape in the middle of the page, e.g. from the mobile carousel. */
export async function addShapeToPage(canvas: FabricCanvas, workspace: WorkspaceInstance, element: DrawingElement) {
    const { Line, Rect, Ellipse, Triangle } = await import("fabric");
    const style = { stroke: DEFAULT_STROKE, strokeWidth: 2, strokeUniform: true, fill: "transparent" };

    const shape =
        element === "line"
            ? new Line([0, 0, BASE, 0], style)
            : element === "circle"
              ? new Ellipse({ ...style, rx: BASE / 2, ry: BASE / 2 })
              : element === "triangle"
                ? new Triangle({ ...style, width: BASE, height: BASE })
                : new Rect({ ...style, width: BASE, height: BASE });

    return placeAtPageCentre(canvas, workspace, shape, SHAPE_SIZE);
}
