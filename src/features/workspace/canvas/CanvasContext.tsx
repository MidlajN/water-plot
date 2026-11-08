
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
}

interface RulerInstance {
    rulerEnable: () => void;
    destroy?: () => void;
}

interface CanvasContextValue {
    canvas: FabricCanvas | null;
    canvasRef: RefObject<HTMLCanvasElement | null>;

    canvasConfig: CanvasConfig;
    setCanvasConfig: Dispatch<SetStateAction<CanvasConfig>>;

    toolRef: RefObject<string>;
    plotterRef: RefObject<unknown>;

    canvasObjs: unknown[] | null;
    setCanvasObjs: Dispatch<SetStateAction<unknown[] | null>>;

    containerRef: RefObject<HTMLDivElement | null>;
    workspace: WorkspaceInstance | null;

    jsonExist: boolean;
    setJsonExist: Dispatch<SetStateAction<boolean>>;

    plotCanvasState: unknown;
    setPlotCanvasState: Dispatch<SetStateAction<unknown>>;
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

    const plotterRef = useRef<unknown>(null);
    const toolRef = useRef("Select");

    const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
    const [workspace, setWorkspace] = useState<WorkspaceInstance | null>(null);

    const [canvasObjs, setCanvasObjs] = useState<unknown[] | null>(null);

    const [jsonExist, setJsonExist] = useState(false);

    const [plotCanvasState, setPlotCanvasState] = useState<unknown>(null);

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

        setWorkspace(instance);
        setCanvas(fabricCanvas);

        // Preserve the original saved-canvas availability check.
        try {
            const savedCanvas = localStorage.getItem("polyPlotCanvas");

            if (savedCanvas) {
            const parsedCanvas = JSON.parse(savedCanvas);

            if (
                Array.isArray(parsedCanvas?.objects) &&
                parsedCanvas.objects.length > 1
            ) {
                setJsonExist(true);
            }
            }
        } catch (error) {
            console.error("Unable to inspect saved canvas:", error);
        }
        };

        initializeCanvas().catch((error: unknown) => {
        if (!disposed) {
            console.error("Canvas initialization failed:", error);
        }
        });

        return () => {
        disposed = true;

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
        plotterRef,

        canvasObjs,
        setCanvasObjs,

        containerRef,
        workspace,

        jsonExist,
        setJsonExist,

        plotCanvasState,
        setPlotCanvasState,
    };

    return (
        <CanvasContext.Provider value={value}>
            {children}
        </CanvasContext.Provider>
    );
}