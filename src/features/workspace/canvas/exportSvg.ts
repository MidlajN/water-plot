"use client";

import type { Canvas as FabricCanvas } from "fabric";

import type {
  WorkspaceInstance,
} from "./CanvasContext";

import "../text/SingleLineText";

export function exportCanvasToSvg( canvas: FabricCanvas, workspace: WorkspaceInstance ): string {
    const ws = workspace.getWorkspace();

    const objects = canvas.getObjects().filter((obj) => {
        if (obj.name === "workspace") return false;

        const fullyContained = obj
            .getCoords()
            .every((point) => ws.containsPoint(point));

        return fullyContained;
    });

    const previousExcludeSettings = new Map(
        objects.map((obj) => [obj, obj.excludeFromExport]),
    );

    const previousViewportTransformation = canvas.svgViewportTransformation;

    try {
        // Export only objects completely inside the workspace.
        canvas.getObjects().forEach((obj) => {
            if (!objects.includes(obj)) {
                obj.excludeFromExport = true;
            }
        });

        canvas.svgViewportTransformation = false;

        const bounds = ws.getBoundingRect();

        return canvas.toSVG({
            width: `${bounds.width * 25.4 / 96}mm`,
            height: `${bounds.height * 25.4 / 96}mm`,
            viewBox: {
                x: bounds.left,
                y: bounds.top,
                width: bounds.width,
                height: bounds.height,
            },
        });
    } finally {
        previousExcludeSettings.forEach((excluded, obj) => {
            obj.excludeFromExport = excluded;
        });

        canvas.svgViewportTransformation = previousViewportTransformation;
    }
}