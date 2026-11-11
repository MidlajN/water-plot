"use client";

import { useState } from "react";

import type { Illustration, IllustrationCategory } from "./library";
import useCanvas from "../workspace/canvas/CanvasContext";
import { addSvgToPage } from "../workspace/canvas/insertSvg";
import { useEditor } from "../workspace/editor/EditorContext";

export const ILLUSTRATION_CATEGORIES: { id: IllustrationCategory; label: string }[] = [
    { id: "characters", label: "Characters" },
    { id: "decorative", label: "Decorative" },
];

export const illustrationUrl = (id: string) => `/api/illustrations/${encodeURIComponent(id)}`;

export type LibraryState =
    | { status: "idle" | "loading" | "error" }
    | { status: "ready"; illustrations: Illustration[] };

/** The illustration catalog from /api/illustrations, loaded on demand. */
export function useIllustrations() {
    const [library, setLibrary] = useState<LibraryState>({ status: "idle" });

    const load = async () => {
        setLibrary({ status: "loading" });
        try {
            const response = await fetch("/api/illustrations");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const { illustrations } = (await response.json()) as { illustrations: Illustration[] };
            setLibrary({ status: "ready", illustrations });
        } catch (error) {
            console.error("Unable to load illustrations:", error);
            setLibrary({ status: "error" });
        }
    };

    /** Loads the catalog unless it is already loaded or loading. */
    const ensureLoaded = () => {
        if (library.status === "idle" || library.status === "error") void load();
    };

    return { library, load, ensureLoaded };
}

/** Something to place on the page: a built-in illustration or an upload. */
export interface PlaceableSvg {
    id: string;
    name: string;
    url: string;
}

/** Fetches an illustration's (or upload's) SVG and places it in the middle of the page. */
export function useInsertIllustration() {
    const canvasContext = useCanvas();
    const { setTool } = useEditor();
    const [inserting, setInserting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /** Resolves true once the illustration is on the page. */
    const insert = async (illustration: PlaceableSvg) => {
        const { canvas, workspace } = canvasContext ?? {};
        if (!canvas || !workspace || inserting) return false;

        setInserting(illustration.id);
        setError(null);
        setTool("Select");
        try {
            const response = await fetch(illustration.url);
            if (response.status === 404) {
                setError(`“${illustration.name}” was removed on another device.`);
                return false;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await addSvgToPage(canvas, workspace, await response.text());
            return true;
        } catch (cause) {
            console.error(`Unable to insert ${illustration.name}:`, cause);
            setError(`Couldn't add ${illustration.name}. Try again.`);
            return false;
        } finally {
            setInserting(null);
        }
    };

    return { inserting, error, insert, clearError: () => setError(null) };
}
