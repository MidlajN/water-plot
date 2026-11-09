"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportCanvasToSvg } from "../canvas/exportSvg";
import { svgToObject } from "../canvas/insertSvg";
import useCanvas from "../canvas/CanvasContext";
import { SideNav } from "../editor/nav/SideBar";
import { FontPicker } from "../editor/nav/FontPicker";
import { useEditor } from "../editor/EditorContext";
import { useMode } from "../../modes/ModeContext";

const EXPORT_FORMATS = {
  svg: { label: "SVG", endpoint: "/api/export/svg", filename: "plotter-export.svg" },
  gcode: { label: "G-code", endpoint: "/api/export/gcode", filename: "plotter-export.gcode" },
} as const;

type ExportFormat = keyof typeof EXPORT_FORMATS;

export function WorkspaceSurface() {
  const canvasContext = useCanvas();

  if (!canvasContext) {
    throw new Error(
      "WorkspaceSurface must be rendered inside CanvasProvider",
    );
  }

  const {
    canvasRef,
    containerRef,
    canvas,
    workspace,
  } = canvasContext;

  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const { setTool } = useEditor();

  const isEditMode = useMode().mode === "edit";

  // While another mode is showing, the hidden editor must not react to keys, and any
  // selection or text edit is closed. Coming back refits the page to the window.
  useEffect(() => {
    if (!canvas || !workspace) return;

    workspace.setActive(isEditMode);

    if (isEditMode) {
      workspace.setZoomAuto();
    } else {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      setTool("Select");
    }
  }, [canvas, workspace, isEditMode, setTool]);

  /*
   * Receive SVG content from external applications.
   * Keep the listener registered only while the canvas is available.
   */
  useEffect(() => {
    if (!canvas) return;

    let disposed = false;

    const handlePostMessage = async (event: MessageEvent) => {
      if (event.data?.type !== "svg") return;

      if (typeof event.data.data !== "string") {
        console.error("Invalid SVG message received.");
        return;
      }

      try {
        const svgObject = await svgToObject(event.data.data);

        if (disposed) return;

        if (!svgObject) {
          console.warn("The imported SVG contains no usable objects.");
          return;
        }

        canvas.add(svgObject);
        canvas.setActiveObject(svgObject);
        canvas.requestRenderAll();
      } catch (error) {
        console.error("Unable to import SVG message:", error);
      }
    };

    window.addEventListener("message", handlePostMessage);

    return () => {
      disposed = true;
      window.removeEventListener("message", handlePostMessage);
    };
  }, [canvas]);

  const handleExport = async (format: ExportFormat) => {
    if (!canvas || !workspace || exporting) return;

    const { endpoint, filename, label } = EXPORT_FORMATS[format];

    setExporting(format);

    try {
      // Generate the SVG from the live Fabric canvas and send it to the Next.js API.
      const svg = exportCanvasToSvg(canvas, workspace);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "image/svg+xml",
        },
        body: svg,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? `${label} export failed.`);
      }

      // Download exactly what the server returned.
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`${label} export failed:`, error);
      alert(
        error instanceof Error ? error.message : `${label} export failed.`,
      );
    } finally {
      setExporting(null);
    }
  };

    return (
        <div className={`h-screen overflow-hidden ${isEditMode ? "flex" : "hidden"}`}>

          <div className="absolute left-4 top-4 z-20 flex gap-2">
            {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((format) => (
              <Button
                key={format}
                onClick={() => handleExport(format)}
                disabled={!canvas || !workspace || exporting !== null}
              >
                {exporting === format
                  ? "Exporting..."
                  : `Export ${EXPORT_FORMATS[format].label}`}
              </Button>
            ))}
          </div>
            <SideNav />

            <main className="relative min-w-0 flex-1">
                <FontPicker />

                <div
                ref={containerRef}
                className="relative h-full w-full overflow-hidden border bg-gray-200"
                >
                <canvas ref={canvasRef} />
                </div>
            </main>
        </div>
    );
}