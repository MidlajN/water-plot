"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportCanvasToSvg } from "../canvas/exportSvg";
import useCanvas from "../canvas/CanvasContext";
import { SideNav } from "../editor/nav/SideBar";
import { FontPicker } from "../editor/nav/FontPicker";
import { useEditor } from "../editor/EditorContext";
import { useMode } from "../../modes/ModeContext";

import type {
  DrawingElement,
  EditorTool,
} from "../editor/EditorContext";

const DEFAULT_STROKE = "#111111";

const EXPORT_FORMATS = {
  svg: { label: "SVG", endpoint: "/api/export/svg", filename: "plotter-export.svg" },
  gcode: { label: "G-code", endpoint: "/api/export/gcode", filename: "plotter-export.gcode" },
} as const;

type ExportFormat = keyof typeof EXPORT_FORMATS;

/*
 * Temporary compatibility state for the existing SideNav.
 * Tool and drawing-element state now belong to EditorContext.
 */

interface LayoutState {
  expanded: boolean;
  hideSideBar: boolean;
  started: boolean;
}

interface LegacyNavState extends LayoutState {
  tool: EditorTool;
  element: DrawingElement;
  stroke: string;
  strokeColor: string;
}

type LayoutAction =
  | { type: "TOGGLE_EXPANDED"; payload: boolean }
  | { type: "TOGGLE_SIDEBAR"; payload: boolean }
  | { type: "SET_STARTED"; payload: boolean }
  | { type: "UPDATE_STATE"; payload: Partial<LayoutState> };

interface LegacyAction {
  type: string;
  payload?: unknown;
}

const initialLayoutState: LayoutState = {
  expanded: true,
  hideSideBar: false,
  started: false,
};

function layoutReducer(
  state: LayoutState,
  action: LayoutAction,
): LayoutState {
  switch (action.type) {
    case "TOGGLE_EXPANDED":
      return { ...state, expanded: action.payload };

    case "TOGGLE_SIDEBAR":
      return { ...state, hideSideBar: action.payload };

    case "SET_STARTED":
      return { ...state, started: action.payload };

    case "UPDATE_STATE":
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

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

  const {
    tool,
    element,
    setTool,
    setElement,
  } = useEditor();


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

  // Only navigation/layout state remains in the reducer.
  const [layoutState, dispatchLayout] = useReducer(
    layoutReducer,
    initialLayoutState,
  );

  /*
   * Temporary adapter for the existing SideNav.
   *
   * SET_TOOL and SET_ELEMENT are routed to EditorContext.
   * Layout actions are routed to the local reducer.
   */

  const dispatch = useCallback(
    (action: LegacyAction) => {
      switch (action.type) {
        case "SET_TOOL":
          if (typeof action.payload === "string") {
            setTool(action.payload as EditorTool);
          }
          return;

        case "SET_ELEMENT":
          if (typeof action.payload === "string") {
            setElement(action.payload as DrawingElement);
          }
          return;

        case "SET_STROKE_COLOR":
          // Colour management is intentionally not used.
          return;

        case "TOGGLE_EXPANDED":
          if (typeof action.payload === "boolean") {
            dispatchLayout({
              type: "TOGGLE_EXPANDED",
              payload: action.payload,
            });
          }
          return;

        case "TOGGLE_SIDEBAR":
          if (typeof action.payload === "boolean") {
            dispatchLayout({
              type: "TOGGLE_SIDEBAR",
              payload: action.payload,
            });
          }
          return;

        case "SET_STARTED":
          if (typeof action.payload === "boolean") {
            dispatchLayout({
              type: "SET_STARTED",
              payload: action.payload,
            });
          }
          return;

        case "UPDATE_STATE": {
          if (
            typeof action.payload !== "object" ||
            action.payload === null
          ) {
            return;
          }

          const updates = action.payload as Record<string, unknown>;

          if (typeof updates.tool === "string") {
            setTool(updates.tool as EditorTool);
          }

          if (typeof updates.element === "string") {
            setElement(updates.element as DrawingElement);
          }

          const layoutUpdates: Partial<LayoutState> = {};

          if (typeof updates.expanded === "boolean") {
            layoutUpdates.expanded = updates.expanded;
          }

          if (typeof updates.hideSideBar === "boolean") {
            layoutUpdates.hideSideBar = updates.hideSideBar;
          }

          if (typeof updates.started === "boolean") {
            layoutUpdates.started = updates.started;
          }

          dispatchLayout({
            type: "UPDATE_STATE",
            payload: layoutUpdates,
          });

          return;
        }

        default:
          return;
      }
    },
    [setTool, setElement],
  );

  // Compatibility object for the legacy SideNav component.
  const navState: LegacyNavState = {
    ...layoutState,
    tool,
    element,
    stroke: DEFAULT_STROKE,
    strokeColor: DEFAULT_STROKE,
  };

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
        const { loadSVGFromString, util } = await import("fabric");

        const loadedSvg = await loadSVGFromString(event.data.data);

        if (disposed) return;

        const svgObjects = loadedSvg.objects.filter(
          (object) => object !== null,
        );

        if (svgObjects.length === 0) {
          console.warn("The imported SVG contains no usable objects.");
          return;
        }

        svgObjects.forEach((object) => {
          object.set({
            stroke: DEFAULT_STROKE,
            strokeWidth: 2,
            fill: "transparent",
          });
        });

        const svgObject = util.groupSVGElements(
          svgObjects,
          loadedSvg.options,
        );

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
            <SideNav
                state={navState}
                dispatch={dispatch}
            />

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