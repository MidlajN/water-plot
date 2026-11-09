"use client";

import { useMemo, useState } from "react";
import { ArrowSquareOut, ArrowsClockwise, CaretLeft, CaretRight, CircleNotch, Globe, MagicWand, PlusSquare } from "@phosphor-icons/react";

import { focusRing } from "../../desktop/parts";
import { useMode } from "../../modes/ModeContext";
import useCanvas from "../../workspace/canvas/CanvasContext";
import { addDesignToWorkspace } from "../addToWorkspace";
import { getSingleLineFont } from "../../workspace/text/fonts";
import { layoutTextInBox } from "../../workspace/text/layoutText";
import { CATEGORY_LABEL, REFINEMENT_SUGGESTIONS, useAiStudio, type DesignVersion } from "../AiStudioContext";
import { LIMITS, MARGIN_MM } from "../constants";

const hostOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

/**
 * The page as it will be plotted: a white sheet at the working area's true proportions,
 * its margin, the (sanitized) illustration, and the text lettered with the same
 * single-line font the plotter uses.
 */
function Sheet({ version, dimmed }: { version: DesignVersion; dimmed: boolean }) {
    const { design } = version;
    const { width, height } = design.layout;

    const lettering = useMemo(() => {
        if (!design.text) return null;
        return layoutTextInBox(getSingleLineFont(design.text.fontId), design.text.lines, design.text.box);
    }, [design.text]);

    const illustration = design.illustration
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(design.illustration.svg)}`
        : null;
    const label = [design.title, design.text?.lines.join(" / ")].filter(Boolean).join(": ");

    return (
        <svg
            role="img"
            aria-label={`Preview of ${label}`}
            viewBox={`-4 -4 ${width + 8} ${height + 8}`}
            className={`block w-full transition-opacity ${dimmed ? "opacity-40" : ""}`}
        >
            <rect x={0} y={0} width={width} height={height} fill="#fff" stroke="#c9d0d5" strokeWidth={0.8} />
            <rect
                x={MARGIN_MM}
                y={MARGIN_MM}
                width={width - 2 * MARGIN_MM}
                height={height - 2 * MARGIN_MM}
                fill="none"
                stroke="#d9dfe3"
                strokeWidth={0.5}
                strokeDasharray="3 3"
            />
            {illustration && <image href={illustration} x={0} y={0} width={width} height={height} />}
            {lettering && (
                <path d={lettering.d} fill="none" stroke="#000" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" />
            )}
        </svg>
    );
}

/** Preview of the version on show, with Regenerate, Refine and version stepping. */
export function DesignPreview({ compact = false }: { compact?: boolean }) {
    const { current, versions, index, showVersion, regenerate, refine, busy, activity } = useAiStudio();
    const { canvas, workspace } = useCanvas() ?? {};
    const { setMode } = useMode();
    const [instruction, setInstruction] = useState("");
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    if (!current) return null;

    const addToWorkspace = async () => {
        if (!canvas || !workspace || adding) return;
        setAdding(true);
        setAddError(null);
        try {
            await addDesignToWorkspace(canvas, workspace, current.design);
            // Show the page with the new, selected objects.
            setMode("edit");
        } catch (error) {
            setAddError(error instanceof Error ? error.message : "Couldn't add the design to the page.");
        } finally {
            setAdding(false);
        }
    };

    const { design, sources, usedWebSearch } = current;
    const working = activity.status === "working";

    const submitRefine = (text: string) => {
        if (busy || !text.trim()) return;
        void refine(text);
        setInstruction("");
    };

    return (
        <article aria-label="Design preview" className={`space-y-4 rounded-xl border border-rule bg-white ${compact ? "p-3" : "p-5"}`}>
            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <h3 className="text-base font-semibold text-ink">{design.title}</h3>
                        <span className="text-xs text-graphite">{CATEGORY_LABEL[design.category]}</span>
                    </div>
                    {design.description && <p className="text-sm leading-6 text-graphite">{design.description}</p>}
                    {current.refinement && <p className="text-xs text-graphite">Refined: “{current.refinement}”</p>}
                </div>

                {versions.length > 1 && (
                    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Versions">
                        <button
                            type="button"
                            aria-label="Previous version"
                            disabled={index === 0 || busy}
                            onClick={() => showVersion(index - 1)}
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-graphite hover:bg-desk disabled:opacity-35 ${focusRing}`}
                        >
                            <CaretLeft size={14} />
                        </button>
                        <span className="font-mono text-xs tabular-nums text-graphite">
                            {index + 1}/{versions.length}
                        </span>
                        <button
                            type="button"
                            aria-label="Next version"
                            disabled={index === versions.length - 1 || busy}
                            onClick={() => showVersion(index + 1)}
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-graphite hover:bg-desk disabled:opacity-35 ${focusRing}`}
                        >
                            <CaretRight size={14} />
                        </button>
                    </div>
                )}
            </header>

            <figure className="space-y-1.5">
                <div className="rounded-lg bg-desk p-2 sm:p-3">
                    <Sheet version={current} dimmed={working} />
                </div>
                <figcaption className="text-xs text-graphite">
                    {design.layout.width} × {design.layout.height} mm page. The dashed line marks the {MARGIN_MM} mm margin.
                </figcaption>
            </figure>

            <div className="space-y-1.5">
                <button
                    type="button"
                    onClick={() => void addToWorkspace()}
                    disabled={busy || adding || !canvas || !workspace}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal text-sm font-medium text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-teal/40 ${focusRing}`}
                >
                    {adding ? <CircleNotch size={17} className="motion-safe:animate-spin" /> : <PlusSquare size={17} />}
                    {adding ? "Adding…" : "Add to workspace"}
                </button>
                <p className="text-center text-xs text-graphite">
                    {addError ? <span role="alert" className="text-fault">{addError}</span> : "Adds it to your page in Edit mode, where you can move, resize and edit it."}
                </p>
            </div>

            <div className="space-y-2.5 border-t border-rule pt-4">
                <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitRefine(instruction);
                    }}
                >
                    <label className="min-w-0 flex-1">
                        <span className="sr-only">How should it change?</span>
                        <input
                            value={instruction}
                            onChange={(event) => setInstruction(event.target.value.slice(0, LIMITS.refinementMax))}
                            maxLength={LIMITS.refinementMax}
                            disabled={busy}
                            placeholder="How should it change? e.g. make the petals rounder"
                            className={`h-10 w-full rounded-lg border border-rule bg-white px-3 text-ink placeholder:text-graphite/60 disabled:bg-desk/50 ${
                                compact ? "text-base" : "text-[13px]"
                            } ${focusRing}`}
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={busy || !instruction.trim()}
                        className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-rule bg-white px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-desk disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
                    >
                        <MagicWand size={15} />
                        Refine
                    </button>
                </form>

                <div className="flex flex-wrap items-center gap-1.5">
                    {REFINEMENT_SUGGESTIONS.map((suggestion) => (
                        <button
                            key={suggestion}
                            type="button"
                            disabled={busy}
                            onClick={() => submitRefine(suggestion)}
                            className={`rounded-full border border-rule px-3 py-1 text-xs text-ink transition-colors hover:bg-desk disabled:opacity-50 ${focusRing}`}
                        >
                            {suggestion}
                        </button>
                    ))}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void regenerate()}
                        className={`ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-graphite hover:bg-desk hover:text-ink disabled:opacity-50 ${focusRing}`}
                    >
                        <ArrowsClockwise size={14} />
                        Regenerate
                    </button>
                </div>
            </div>

            {usedWebSearch && (
                <div className="space-y-1.5 border-t border-rule pt-3">
                    <p className="flex items-center gap-1.5 text-xs text-graphite">
                        <Globe size={14} />
                        Researched on the web
                    </p>
                    {sources.length > 0 && (
                        <ul className="space-y-1">
                            {sources.map((source) => (
                                <li key={source.url}>
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex max-w-full items-center gap-1 text-xs text-teal hover:underline ${focusRing}`}
                                    >
                                        <span className="truncate">{source.title ?? hostOf(source.url)}</span>
                                        <span className="shrink-0 text-graphite">{hostOf(source.url)}</span>
                                        <ArrowSquareOut size={12} className="shrink-0" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </article>
    );
}
