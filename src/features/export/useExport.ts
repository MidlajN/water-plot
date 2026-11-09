"use client";

import { useState } from "react";

import useCanvas from "../workspace/canvas/CanvasContext";
import { exportCanvasToSvg } from "../workspace/canvas/exportSvg";

export const EXPORT_FORMATS = {
    svg: { label: "SVG", endpoint: "/api/export/svg", filename: "plotter-export.svg" },
    gcode: { label: "G-code", endpoint: "/api/export/gcode", filename: "plotter-export.gcode" },
} as const;

export type ExportFormat = keyof typeof EXPORT_FORMATS;

/** Sends the page to the export API and downloads what it returns. */
export function useExport() {
    const { canvas, workspace } = useCanvas() ?? {};
    const [exporting, setExporting] = useState<ExportFormat | null>(null);

    const exportAs = async (format: ExportFormat) => {
        if (!canvas || !workspace || exporting) return;

        const { endpoint, filename, label } = EXPORT_FORMATS[format];
        setExporting(format);

        try {
            // Generate the SVG from the live Fabric canvas and send it to the Next.js API.
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "image/svg+xml" },
                body: exportCanvasToSvg(canvas, workspace),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error ?? `${label} export failed.`);
            }

            // Download exactly what the server returned.
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(`${label} export failed:`, error);
            alert(error instanceof Error ? error.message : `${label} export failed.`);
        } finally {
            setExporting(null);
        }
    };

    return { exporting, exportAs, ready: Boolean(canvas && workspace) };
}
