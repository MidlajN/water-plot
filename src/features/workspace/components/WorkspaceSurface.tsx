"use client";

import useCanvas from "../canvas/CanvasContext";

export function WorkspaceSurface() {
    const { canvasRef, containerRef } = useCanvas();

    return (
        <div className="h-[calc(100dvh)] w-full overflow-hidden bg-neutral-100">
            <div
                ref={containerRef}
                className="relative h-full w-full overflow-hidden border bg-gray-200"
            >
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}