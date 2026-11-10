"use client";

import { useMemo, useState } from "react";
import { ArrowSquareOut, ArrowsClockwise, CaretLeft, CaretRight, CircleNotch, Globe, MagicWand, PlusSquare } from "@phosphor-icons/react";

import { motion, useReducedMotion } from "framer-motion";

import { focusRing, PrimaryButton } from "../../desktop/parts";
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
            <rect x={0} y={0} width={width} height={height} fill="#fff" stroke="#d4d8de" strokeWidth={0.6} />
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
    const reduceMotion = useReducedMotion();
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
        <motion.article
            // A new design (or another version) fades and lifts in.
            key={`${versions.length}-${index}`}
            aria-label="Design preview"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.45 }}
            className={`space-y-4 rounded-[1.25rem] bg-white ${compact ? "p-4" : "p-5"}`}
        >
            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <p className="type-caption font-semibold uppercase tracking-[0.04em] text-teal">{CATEGORY_LABEL[design.category]}</p>
                    <h3 className="type-headline text-ink">{design.title}</h3>
                    {design.description && <p className="type-footnote text-graphite">{design.description}</p>}
                    {current.refinement && <p className="type-caption text-graphite">Refined: “{current.refinement}”</p>}
                </div>

                {versions.length > 1 && (
                    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-grouped p-0.5" role="group" aria-label="Versions">
                        <button
                            type="button"
                            aria-label="Previous version"
                            disabled={index === 0 || busy}
                            onClick={() => showVersion(index - 1)}
                            className={`press flex h-7 w-7 items-center justify-center rounded-full text-ink hover:bg-white disabled:opacity-30 ${focusRing}`}
                        >
                            <CaretLeft size={14} weight="bold" />
                        </button>
                        <span className="type-caption min-w-8 text-center font-semibold tabular-nums text-ink">
                            {index + 1}/{versions.length}
                        </span>
                        <button
                            type="button"
                            aria-label="Next version"
                            disabled={index === versions.length - 1 || busy}
                            onClick={() => showVersion(index + 1)}
                            className={`press flex h-7 w-7 items-center justify-center rounded-full text-ink hover:bg-white disabled:opacity-30 ${focusRing}`}
                        >
                            <CaretRight size={14} weight="bold" />
                        </button>
                    </div>
                )}
            </header>

            <figure className="space-y-1.5">
                <div className="rounded-xl bg-grouped p-2 sm:p-3">
                    <Sheet version={current} dimmed={working} />
                </div>
                <figcaption className="type-caption px-1 text-graphite">
                    {design.layout.width} × {design.layout.height} mm page. The dashed line marks the {MARGIN_MM} mm margin.
                </figcaption>
            </figure>

            <div className="space-y-1.5">
                <PrimaryButton
                    icon={adding ? <CircleNotch size={17} weight="bold" className="motion-safe:animate-spin" /> : <PlusSquare size={17} weight="bold" />}
                    onClick={() => void addToWorkspace()}
                    disabled={busy || adding || !canvas || !workspace}
                >
                    {adding ? "Adding…" : "Add to workspace"}
                </PrimaryButton>
                <p className="type-caption text-center text-graphite">
                    {addError ? <span role="alert" className="text-fault">{addError}</span> : "Adds it to your page in Edit mode, where you can move, resize and edit it."}
                </p>
            </div>

            <div className="space-y-2.5 border-t border-separator pt-4">
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
                            className={`h-10 w-full rounded-xl bg-grouped px-3.5 text-ink outline-none placeholder:text-graphite/60 focus:ring-2 focus:ring-teal/50 disabled:text-graphite ${
                                compact ? "text-base" : "type-footnote"
                            }`}
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={busy || !instruction.trim()}
                        className={`press type-footnote flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-black/[0.055] px-3.5 font-semibold text-ink hover:bg-black/[0.08] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                    >
                        <MagicWand size={15} weight="bold" />
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
                            className={`press type-footnote rounded-full bg-grouped px-3.5 py-1.5 text-ink hover:bg-black/[0.07] disabled:opacity-50 ${focusRing}`}
                        >
                            {suggestion}
                        </button>
                    ))}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void regenerate()}
                        className={`press type-footnote ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-teal hover:bg-teal/10 disabled:opacity-50 ${focusRing}`}
                    >
                        <ArrowsClockwise size={14} weight="bold" />
                        Regenerate
                    </button>
                </div>
            </div>

            {usedWebSearch && (
                <div className="space-y-1.5 border-t border-separator pt-3">
                    <p className="type-caption flex items-center gap-1.5 font-semibold text-graphite">
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
                                        className={`type-caption inline-flex max-w-full items-center gap-1 text-teal hover:underline ${focusRing}`}
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
        </motion.article>
    );
}
