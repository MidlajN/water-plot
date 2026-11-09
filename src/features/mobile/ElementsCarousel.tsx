"use client";

import { useEffect, useState } from "react";

import {
    ILLUSTRATION_CATEGORIES,
    illustrationUrl,
    useIllustrations,
    useInsertIllustration,
} from "../illustrations/useIllustrations";
import type { IllustrationCategory } from "../illustrations/library";
import useCanvas from "../workspace/canvas/CanvasContext";
import { addShapeToPage } from "../workspace/canvas/placeOnPage";
import { useEditor } from "../workspace/editor/EditorContext";
import { SHAPES } from "../workspace/editor/nav/shapes";

type Tab = "shapes" | IllustrationCategory;

const TABS: { id: Tab; label: string }[] = [{ id: "shapes", label: "Shapes" }, ...ILLUSTRATION_CATEGORIES];

const card =
    "flex h-16 w-16 shrink-0 snap-start items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 transition-colors active:bg-gray-200 disabled:opacity-50";

/**
 * Mobile Elements picker: category chips over a sideways-scrolling strip of shapes or
 * illustrations. Tapping an item puts it in the middle of the page, selected.
 */
export function ElementsCarousel() {
    const { canvas, workspace } = useCanvas() ?? {};
    const { setTool } = useEditor();
    const { library, load, ensureLoaded } = useIllustrations();
    const { inserting, error, insert } = useInsertIllustration();
    const [tab, setTab] = useState<Tab>("shapes");

    // Fetch the catalog once the carousel is on screen.
    useEffect(ensureLoaded, []); // eslint-disable-line react-hooks/exhaustive-deps

    const addShape = (element: (typeof SHAPES)[number]["element"]) => {
        if (!canvas || !workspace) return;
        setTool("Select");
        void addShapeToPage(canvas, workspace, element);
    };

    const items = library.status === "ready" ? library.illustrations.filter((item) => item.category === tab) : [];

    return (
        <section aria-label="Elements" className="space-y-2">
            <div role="tablist" aria-label="Element type" className="flex gap-1.5 overflow-x-auto">
                {TABS.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => setTab(id)}
                        className={`h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-colors ${
                            tab === id ? "bg-[#1c8096] text-white" : "bg-gray-100 text-gray-600"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tab === "shapes" &&
                    SHAPES.map((shape) => (
                        <button key={shape.element} type="button" aria-label={`Add ${shape.label}`} onClick={() => addShape(shape.element)} className={card}>
                            {shape.icon("#4b5563")}
                        </button>
                    ))}

                {tab !== "shapes" && library.status === "loading" && <p className="py-5 text-sm text-gray-500">Loading…</p>}

                {tab !== "shapes" && library.status === "error" && (
                    <p className="py-5 text-sm text-gray-600">
                        Couldn&apos;t load illustrations.{" "}
                        <button type="button" onClick={() => void load()} className="font-medium text-[#1c8096] underline">
                            Retry
                        </button>
                    </p>
                )}

                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-label={`Add ${item.name}`}
                        disabled={inserting !== null}
                        onClick={() => void insert(item)}
                        className={card}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element -- small SVG thumbnails from our own API */}
                        <img src={illustrationUrl(item.id)} alt="" className="h-12 w-12 object-contain" />
                    </button>
                ))}
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </section>
    );
}
