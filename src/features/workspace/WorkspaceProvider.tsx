"use client";

import type { PropsWithChildren } from "react";

import { CanvasProvider } from "./canvas/CanvasContext";
import { EditorProvider } from "./editor/EditorContext";
import { EditorController } from "./editor/EditorController";

export function WorkspaceProviders({ children }: PropsWithChildren) {
    return (
        <CanvasProvider>
            <EditorProvider>
                <EditorController />
                {children}
            </EditorProvider>
        </CanvasProvider>
    );
}