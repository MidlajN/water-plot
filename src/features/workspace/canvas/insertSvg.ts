"use client";

import type { Canvas as FabricCanvas, FabricObject } from "fabric";

import type { WorkspaceInstance } from "./CanvasContext";

const DEFAULT_STROKE = "#111111";

/**
 * Parses SVG markup into one Fabric object styled as pen strokes (stroke only, no fill).
 * Returns null when the SVG has nothing drawable.
 */
export async function svgToObject(svg: string): Promise<FabricObject | null> {
    const { loadSVGFromString, util } = await import("fabric");
    const { objects, options } = await loadSVGFromString(svg);
    const drawable = objects.filter((object): object is FabricObject => object !== null);
    if (!drawable.length) return null;

    drawable.forEach((object) =>
        object.set({ stroke: DEFAULT_STROKE, strokeWidth: 2, strokeUniform: true, fill: "transparent" }),
    );
    return util.groupSVGElements(drawable, options);
}

/** Share of the page's shorter side an inserted illustration takes up. */
const ILLUSTRATION_SIZE = 0.3;

/** Adds an SVG to the middle of the page, sized to fit, and selects it. */
export async function addSvgToPage(canvas: FabricCanvas, workspace: WorkspaceInstance, svg: string) {
    const object = await svgToObject(svg);
    if (!object) throw new Error("The illustration has nothing to draw.");

    const page = workspace.getWorkspace();
    const target = Math.min(page.width * page.scaleX, page.height * page.scaleY) * ILLUSTRATION_SIZE;
    object.scale(target / Math.max(object.width, object.height));
    object.setPositionByOrigin(page.getCenterPoint(), "center", "center");
    object.setCoords();

    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    return object;
}
