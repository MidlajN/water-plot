"use client";

import { useEffect } from "react";
import { svgToObject } from "../canvas/insertSvg";
import useCanvas from "../canvas/CanvasContext";
import { SideNav } from "../editor/nav/SideBar";
import { FontPicker } from "../editor/nav/FontPicker";
import { useEditor } from "../editor/EditorContext";
import { useMode } from "../../modes/ModeContext";

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

    return (
        // Mobile: the page fills the top half; the bottom card (MobileSheet) holds the controls.
        <div className={`relative h-[52dvh] overflow-hidden md:h-full ${isEditMode ? "flex" : "hidden"}`}>

            <SideNav />

            <main className="relative min-w-0 flex-1">
                <FontPicker />

                <div
                ref={containerRef}
                className="relative h-full w-full overflow-hidden bg-surface-sunken"
                >
                <canvas ref={canvasRef} />
                </div>
            </main>
        </div>
    );
}