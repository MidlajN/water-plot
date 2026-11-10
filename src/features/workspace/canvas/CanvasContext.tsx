
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import type { Canvas as FabricCanvas, FabricObject } from "fabric";

import { readCanvasTheme, type CanvasTheme } from "./theme";

export interface CanvasConfig {
    width: number;
    height: number;
    orientation: "vertical" | "horizontal";
    maxWidth: number;
    maxHeight: number;
}

export interface WorkspaceInstance {
    getCanvas: () => FabricCanvas;
    destroy: () => void;
    getWorkspace: () => FabricObject;
    setZoomAuto: () => void;
    setActive: (active: boolean) => void;
    /** Restores the drawing saved when the page was last closed. */
    loadFromJSON: () => Promise<void>;
    undo: () => void;
    redo: () => void;
    /** Removes the selected object(s). */
    handleDelete: () => void;
    /** Recolours the selection, sheet and desk from the design tokens. */
    applyTheme: (theme: CanvasTheme) => void;
}

interface RulerInstance {
    rulerEnable: () => void;
    setTheme: (theme: CanvasTheme) => void;
    destroy?: () => void;
}

interface CanvasContextValue {
    canvas: FabricCanvas | null;
    canvasRef: RefObject<HTMLCanvasElement | null>;

    canvasConfig: CanvasConfig;
    setCanvasConfig: Dispatch<SetStateAction<CanvasConfig>>;

    toolRef: RefObject<string>;

    containerRef: RefObject<HTMLDivElement | null>;
    workspace: WorkspaceInstance | null;


}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export default function useCanvas() {
    return useContext(CanvasContext);
}


export function CanvasProvider({
    children,
}: {
  children: React.ReactNode;
}) {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const toolRef = useRef("Select");

    const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
    const [workspace, setWorkspace] = useState<WorkspaceInstance | null>(null);

    const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>({
        width: 690,
        height: 290,
        orientation: "vertical",
        maxWidth: 298,
        maxHeight: 420,
    });

    const initialConfigRef = useRef(canvasConfig);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        let disposed = false;

        let workspaceInstance: WorkspaceInstance | null = null;
        let rulerInstance: RulerInstance | null = null;
        let themeObserver: MutationObserver | null = null;

        const initializeCanvas = async () => {
        // Import browser-dependent modules only after mounting.
        const controls = await import("./plugins/controls/control");

        controls.setFabricDefaults();

        await controls.preloadAllIcons();

        controls.defineControlPoints();

        if (disposed) return;

        const [{ Workspace }, { default: CanvasRuler }] =
            await Promise.all([
                import("./plugins/workspace/workspace.jsx"),
                import("./plugins/workspace/ruler"),
            ]);

        if (disposed || !canvasRef.current || !containerRef.current) {
            return;
        }

        const instance = new Workspace(
            canvasRef,
            initialConfigRef.current,
            setCanvasConfig,
            containerRef,
            toolRef
        ) as WorkspaceInstance;

        workspaceInstance = instance;

        const fabricCanvas = instance.getCanvas();

        const ruler = new CanvasRuler(fabricCanvas) as RulerInstance;

        rulerInstance = ruler;

        ruler.rulerEnable();

        if (disposed) {
            ruler.destroy?.();
            instance.destroy();
            return;
        }

        await instance.loadFromJSON();
        if (disposed) return;

        // Canvas colours follow the theme: read the tokens where the canvas sits, and
        // again whenever any data-theme attribute changes.
        const applyTheme = () => {
            if (!containerRef.current) return;
            const theme = readCanvasTheme(containerRef.current);
            instance.applyTheme(theme);
            ruler.setTheme(theme);
        };
        applyTheme();
        themeObserver = new MutationObserver(applyTheme);
        themeObserver.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-theme"] });

        setWorkspace(instance);
        setCanvas(fabricCanvas);
        };

        initializeCanvas().catch((error: unknown) => {
        if (!disposed) {
            console.error("Canvas initialization failed:", error);
        }
        });

        return () => {
        disposed = true;

        themeObserver?.disconnect();
        rulerInstance?.destroy?.();
        workspaceInstance?.destroy();
        };
    }, []);

    const value: CanvasContextValue = {
        canvas,
        canvasRef,

        canvasConfig,
        setCanvasConfig,

        toolRef,

        containerRef,
        workspace,
    };

    return (
        <CanvasContext.Provider value={value}>
            {children}
        </CanvasContext.Provider>
    );
}