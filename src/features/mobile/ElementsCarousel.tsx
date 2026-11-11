"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";

import {
    ILLUSTRATION_CATEGORIES,
    illustrationUrl,
    useIllustrations,
    useInsertIllustration,
} from "../illustrations/useIllustrations";
import type { IllustrationCategory } from "../illustrations/library";
import { pickSvgFiles, uploadUrl, useUploads, type Upload } from "../uploads/UploadsContext";
import { AddUploadTile, PendingTile, TileMotion, UPLOADS_HINT, UploadNotices, UploadTile } from "../uploads/UploadsUI";
import useCanvas from "../workspace/canvas/CanvasContext";
import { addShapeToPage } from "../workspace/canvas/placeOnPage";
import { useEditor } from "../workspace/editor/EditorContext";
import { SHAPES } from "../workspace/editor/nav/shapes";

type Tab = "shapes" | IllustrationCategory | "uploads";

const TABS: { id: Tab; label: string }[] = [{ id: "shapes", label: "Shapes" }, ...ILLUSTRATION_CATEGORIES, { id: "uploads", label: "Uploads" }];

const card =
    "press flex h-16 w-16 shrink-0 snap-start items-center justify-center rounded-2xl bg-grouped text-ink outline-none active:bg-ink/[0.08] focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-50";

/**
 * Mobile Elements picker: category chips over a sideways-scrolling strip of shapes,
 * illustrations or your uploads. Tapping an item puts it in the middle of the page,
 * selected. Uploads: the dashed + tile adds SVGs (one file is placed right away), and
 * Edit shows a remove button on each.
 */
export function ElementsCarousel() {
    const { canvas, workspace } = useCanvas() ?? {};
    const { setTool } = useEditor();
    const { library, load, ensureLoaded } = useIllustrations();
    const { inserting, error, insert } = useInsertIllustration();
    const uploads = useUploads();
    const [tab, setTab] = useState<Tab>("shapes");
    const [editing, setEditing] = useState(false);
    const strip = useRef<HTMLDivElement>(null);
    const tabList = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    // Fetch the catalog once the carousel is on screen, and refresh the uploads (another
    // device may have added or removed some).
    useEffect(ensureLoaded, []); // eslint-disable-line react-hooks/exhaustive-deps
    const { refresh } = uploads;
    useEffect(() => void refresh(), [refresh]);

    const addShape = (element: (typeof SHAPES)[number]["element"]) => {
        if (!canvas || !workspace) return;
        setTool("Select");
        void addShapeToPage(canvas, workspace, element);
    };

    const placeUpload = async (upload: Upload) => {
        if (!(await insert({ id: upload.id, name: upload.name, url: uploadUrl(upload.id) }))) void refresh();
    };

    const pickAndUpload = async () => {
        const files = await pickSvgFiles();
        if (!files.length) return;
        // New tiles arrive at the front, so bring the start of the strip into view.
        strip.current?.scrollTo({ left: 0, behavior: reduceMotion ? "auto" : "smooth" });
        const saved = await uploads.upload(files);
        if (saved) await placeUpload(saved);
    };

    const items = library.status === "ready" ? library.illustrations.filter((item) => item.category === tab) : [];
    const showEdit = tab === "uploads" && uploads.list.length > 0;
    const editingUploads = editing && showEdit;

    // Keep the selected chip fully in view, including when the Edit button takes room.
    useEffect(() => {
        tabList.current
            ?.querySelector('[aria-selected="true"]')
            ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }, [tab, showEdit, editingUploads, reduceMotion]);
    const uploadsEmpty = uploads.status === "ready" && !uploads.list.length && !uploads.pending.length;

    return (
        <section aria-label="Elements" className="space-y-2">
            <div className="-mx-4 flex items-center pr-3">
                <div ref={tabList} role="tablist" aria-label="Element type" className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto scroll-px-4 px-4">
                    {TABS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            onClick={() => {
                                setTab(id);
                                setEditing(false);
                            }}
                            className={`press type-footnote h-8 shrink-0 rounded-full px-3.5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                                tab === id ? "bg-teal text-on-accent" : "bg-grouped text-ink/75"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {showEdit && (
                    <button
                        type="button"
                        aria-pressed={editingUploads}
                        onClick={() => setEditing(!editingUploads)}
                        className="press type-footnote h-8 shrink-0 rounded-full px-2 font-semibold text-teal outline-none focus-visible:ring-2 focus-visible:ring-teal"
                    >
                        {editingUploads ? "Done" : "Edit"}
                    </button>
                )}
            </div>

            <div ref={strip} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-4 pb-1">
                {tab === "shapes" &&
                    SHAPES.map((shape) => (
                        <button key={shape.element} type="button" aria-label={`Add ${shape.label}`} onClick={() => addShape(shape.element)} className={card}>
                            {shape.icon("currentColor")}
                        </button>
                    ))}

                {tab !== "shapes" && tab !== "uploads" && library.status === "loading" && <p className="type-footnote py-5 text-graphite">Loading…</p>}

                {tab !== "shapes" && tab !== "uploads" && library.status === "error" && (
                    <p className="type-footnote py-5 text-graphite">
                        Couldn&apos;t load illustrations.{" "}
                        <button type="button" onClick={() => void load()} className="font-semibold text-teal">
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
                        onClick={() => void insert({ id: item.id, name: item.name, url: illustrationUrl(item.id) })}
                        className={card}
                    >
                        {/* Drawn in black ink; inverted to white lines in dark mode. */}
                        {/* eslint-disable-next-line @next/next/no-img-element -- small SVG thumbnails from our own API */}
                        <img src={illustrationUrl(item.id)} alt="" className="h-12 w-12 object-contain dark:invert" />
                    </button>
                ))}

                {tab === "uploads" && (
                    <AnimatePresence initial={false} mode="popLayout">
                        <TileMotion key="add" className="shrink-0 snap-start">
                            <AddUploadTile onPick={() => void pickAndUpload()} disabled={editingUploads} className="h-16 w-16 rounded-2xl" />
                        </TileMotion>
                        {uploads.pending.map((item) => (
                            <TileMotion key={`pending-${item.key}`} className="shrink-0 snap-start">
                                <PendingTile name={item.name} className="h-16 w-16 rounded-2xl" />
                            </TileMotion>
                        ))}
                        {uploads.list.map((upload) => (
                            <TileMotion key={upload.id} className="shrink-0 snap-start">
                                <UploadTile
                                    upload={upload}
                                    onPlace={(item) => void placeUpload(item)}
                                    disabled={inserting !== null}
                                    removal={editingUploads ? "always" : "never"}
                                    className="h-16 w-16 rounded-2xl bg-grouped active:bg-ink/[0.08]"
                                    imageClassName="h-12 w-12"
                                />
                            </TileMotion>
                        ))}
                        {uploadsEmpty && (
                            <TileMotion key="hint" className="flex shrink-0 items-center">
                                <p className="type-footnote w-48 text-graphite">{UPLOADS_HINT}</p>
                            </TileMotion>
                        )}
                        {uploads.status === "idle" && !uploads.list.length && (
                            <TileMotion key="loading" className="flex shrink-0 items-center">
                                <p className="type-footnote text-graphite">Loading…</p>
                            </TileMotion>
                        )}
                        {uploads.status === "error" && !uploads.list.length && (
                            <TileMotion key="error" className="flex shrink-0 items-center">
                                <p className="type-footnote text-graphite">
                                    Couldn&apos;t load your uploads.{" "}
                                    <button type="button" onClick={() => void refresh()} className="font-semibold text-teal">
                                        Retry
                                    </button>
                                </p>
                            </TileMotion>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {tab === "uploads" && <UploadNotices />}
            {error && <p role="alert" className="type-footnote text-fault">{error}</p>}
        </section>
    );
}
