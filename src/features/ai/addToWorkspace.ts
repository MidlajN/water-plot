"use client";

import type { Canvas as FabricCanvas, FabricObject } from "fabric";

import type { WorkspaceInstance } from "../workspace/canvas/CanvasContext";
import { SVG_STROKE_WIDTH, svgToObject } from "../workspace/canvas/insertSvg";
import { DEFAULT_STROKE } from "../workspace/canvas/placeOnPage";
import { getSingleLineFont, hasSingleLineFont } from "../workspace/text/fonts";
import { layoutTextInBox } from "../workspace/text/layoutText";
import type { Design } from "./schema";

/** Line spacing used by layoutTextInBox, applied to the editable text too. */
const LINE_HEIGHT = 1.4;
/** SingleLineText puts the baseline this far (× font size) below the top of a line. */
const BASELINE_FRACTION = 0.8;

const FORBIDDEN_SVG = /<(script|image|foreignObject|use|style|text|a|iframe)\b|\son\w+\s*=|href\s*=|url\s*\(|javascript:|data:/i;

/** Last check before a design reaches the canvas (it was sanitized on the server). */
function checkDesign(design: Design): string | null {
    const { width, height } = design.layout;
    if (!(width > 0 && height > 0)) return "The design has no page size.";
    if (!design.illustration && !design.text) return "The design is empty.";
    if (design.illustration) {
        const { svg } = design.illustration;
        if (!svg.startsWith("<svg ") || !svg.endsWith("</svg>") || FORBIDDEN_SVG.test(svg)) return "The drawing failed a safety check.";
    }
    if (design.text) {
        if (!hasSingleLineFont(design.text.fontId)) return "The design uses an unknown font.";
        if (![design.text.box.x, design.text.box.y, design.text.box.width, design.text.box.height].every(Number.isFinite)) {
            return "The text has an invalid position.";
        }
    }
    return null;
}

/**
 * Adds an approved design to the page: the drawing through the existing SVG import
 * (stroke-only Fabric objects) and the words as editable single-line text, both placed
 * where the preview shows them. Nothing on the canvas is removed or replaced, and the
 * addition is one undo step. Returns the added objects.
 */
export async function addDesignToWorkspace(canvas: FabricCanvas, workspace: WorkspaceInstance, design: Design): Promise<FabricObject[]> {
    const problem = checkDesign(design);
    if (problem) throw new Error(problem);

    const page = workspace.getWorkspace();
    const [topLeft] = page.getCoords();
    // Page pixels per design millimetre (uniform, in case the page has another shape).
    const scale = Math.min(page.getScaledWidth() / design.layout.width, page.getScaledHeight() / design.layout.height);
    const toPage = (x: number, y: number) => ({ left: topLeft.x + x * scale, top: topLeft.y + y * scale });

    const added: FabricObject[] = [];

    if (design.illustration) {
        // Without the mm width/height, Fabric reads the SVG in viewBox units (mm), so the
        // drawing's own bounds map straight onto the page.
        const svg = design.illustration.svg.replace(/\swidth="[\d.]+mm"\s+height="[\d.]+mm"/, "");
        const drawing = await svgToObject(svg);
        if (!drawing) throw new Error("The drawing has nothing to add.");
        drawing.set({ originX: "left", originY: "top" });
        // Half the stroke pads Fabric's bounds. The stroke doesn't scale (strokeUniform),
        // so that padding is drawing units before scaling but page pixels after; correct
        // for the difference so the geometry lands exactly where the preview shows it.
        const pad = SVG_STROKE_WIDTH / 2;
        const shifted = toPage((drawing.left ?? 0) - pad, (drawing.top ?? 0) - pad);
        drawing.set({
            left: shifted.left + pad,
            top: shifted.top + pad,
            scaleX: (drawing.scaleX ?? 1) * scale,
            scaleY: (drawing.scaleY ?? 1) * scale,
        });
        drawing.setCoords();
        added.push(drawing);
    }

    if (design.text) {
        const { SingleLineText } = await import("../workspace/text/SingleLineText");
        const layout = layoutTextInBox(getSingleLineFont(design.text.fontId), design.text.lines, design.text.box);
        if (layout.lines.length) {
            const centreX = design.text.box.x + design.text.box.width / 2;
            const topMm = layout.lines[0].baseline - BASELINE_FRACTION * layout.fontSize;
            const text = new SingleLineText(layout.lines.map((line) => line.text).join("\n"), {
                ...toPage(centreX, topMm),
                originX: "center",
                originY: "top",
                textAlign: "center",
                lineHeight: LINE_HEIGHT,
                fontFamily: design.text.fontId,
                fontSize: layout.fontSize * scale,
                stroke: DEFAULT_STROKE,
            });
            text.setCoords();
            added.push(text as unknown as FabricObject);
        }
    }

    if (!added.length) throw new Error("The design has nothing to add.");

    // One add call: the history records one snapshot containing everything.
    canvas.add(...added);

    const { ActiveSelection } = await import("fabric");
    canvas.discardActiveObject();
    canvas.setActiveObject(added.length > 1 ? new ActiveSelection(added, { canvas }) : added[0]);
    canvas.requestRenderAll();
    return added;
}
