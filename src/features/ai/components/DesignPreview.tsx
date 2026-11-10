"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowSquareOut, ArrowsClockwise, CaretLeft, CaretRight, Globe, MagicWand, PlusSquare } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { Card } from "@/components/ui/panel";
import { PaperOnDesk } from "@/components/ui/paper";
import { Tooltip } from "@/components/ui/tooltip";
import { DURATION, EASE_OUT, RISE } from "@/lib/motion";
import { cn } from "@/lib/utils";
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
 * The page as it will be plotted: the sheet at the working area's true proportions, its
 * margin, the (sanitized) illustration, and the text lettered with the same single-line
 * font the plotter uses. Paper and ink stay paper and ink in both themes.
 */
function Sheet({ version, dimmed }: { version: DesignVersion; dimmed: boolean }) {
    const { design } = version;
    const { width, height } = design.layout;

    const lettering = useMemo(() => {
        if (!design.text) return null;
        return layoutTextInBox(getSingleLineFont(design.text.fontId), design.text.lines, design.text.box);
    }, [design.text]);

    const illustration = design.illustration ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(design.illustration.svg)}` : null;
    const label = [design.title, design.text?.lines.join(" / ")].filter(Boolean).join(": ");

    return (
        <svg
            role="img"
            aria-label={`Preview of ${label}`}
            viewBox={`0 0 ${width} ${height}`}
            className={cn("block w-full rounded-[2px] shadow-paper transition-opacity duration-200", dimmed && "opacity-45")}
            style={{ background: "var(--paper)" }}
        >
            <rect
                x={MARGIN_MM}
                y={MARGIN_MM}
                width={width - 2 * MARGIN_MM}
                height={height - 2 * MARGIN_MM}
                fill="none"
                style={{ stroke: "var(--accent-line)" }}
                strokeWidth={0.6}
                strokeDasharray="3 3"
            />
            {illustration && <image href={illustration} x={0} y={0} width={width} height={height} />}
            {lettering && <path d={lettering.d} fill="none" stroke="#111" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" />}
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
        <motion.div {...RISE}>
            <Card aria-label="Design preview" role="article" className={cn("grid grid-cols-1", compact ? "gap-3 p-3" : "gap-5 p-5")}>
                <header className="flex items-start justify-between gap-4">
                    <div className="grid min-w-0 gap-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                            <h3 className="text-title font-semibold tracking-[-0.01em] text-text">{design.title}</h3>
                            <span className="text-caption font-medium text-subtle">{CATEGORY_LABEL[design.category]}</span>
                        </div>
                        {design.description && <p className="max-w-[60ch] text-ui text-muted">{design.description}</p>}
                        {current.refinement && <p className="text-caption text-subtle">Refined: “{current.refinement}”</p>}
                    </div>

                    {versions.length > 1 && (
                        <div className="flex shrink-0 items-center gap-0.5 rounded-control bg-surface-sunken p-0.5" role="group" aria-label="Versions">
                            <Tooltip label="Previous version">
                                <Button variant="ghost" size="icon-sm" aria-label="Previous version" disabled={index === 0 || busy} onClick={() => showVersion(index - 1)}>
                                    <CaretLeft weight="bold" />
                                </Button>
                            </Tooltip>
                            <span className="numeric min-w-9 text-center text-caption text-muted">
                                {index + 1}/{versions.length}
                            </span>
                            <Tooltip label="Next version">
                                <Button variant="ghost" size="icon-sm" aria-label="Next version" disabled={index === versions.length - 1 || busy} onClick={() => showVersion(index + 1)}>
                                    <CaretRight weight="bold" />
                                </Button>
                            </Tooltip>
                        </div>
                    )}
                </header>

                <figure className="grid gap-2">
                    <PaperOnDesk>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.985 }}
                                animate={{ opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } }}
                                exit={{ opacity: 0, transition: { duration: DURATION.fast } }}
                            >
                                <Sheet version={current} dimmed={working} />
                            </motion.div>
                        </AnimatePresence>
                    </PaperOnDesk>
                    <figcaption className="text-caption text-subtle">
                        {design.layout.width} × {design.layout.height} mm page · dashed line marks the {MARGIN_MM} mm margin
                    </figcaption>
                </figure>

                <div className="grid gap-2">
                    <Button variant="primary" size="lg" block onClick={() => void addToWorkspace()} busy={adding} disabled={busy || !canvas || !workspace}>
                        <PlusSquare weight="bold" />
                        Add to workspace
                    </Button>
                    <p className="text-center text-caption text-muted">
                        {addError ? (
                            <span role="alert" className="text-danger">
                                {addError}
                            </span>
                        ) : (
                            "Adds it to your page in Edit mode, where you can move, resize and edit it."
                        )}
                    </p>
                </div>

                <div className="grid gap-3 border-t border-line pt-4">
                    <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            submitRefine(instruction);
                        }}
                    >
                        <label className="min-w-0 flex-1">
                            <span className="sr-only">How should it change?</span>
                            <Input
                                value={instruction}
                                onChange={(event) => setInstruction(event.target.value.slice(0, LIMITS.refinementMax))}
                                maxLength={LIMITS.refinementMax}
                                disabled={busy}
                                placeholder="How should it change? e.g. make the petals rounder"
                            />
                        </label>
                        <Button type="submit" disabled={busy || !instruction.trim()}>
                            <MagicWand />
                            Refine
                        </Button>
                    </form>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {REFINEMENT_SUGGESTIONS.map((suggestion) => (
                            <Chip key={suggestion} size="sm" disabled={busy} onClick={() => submitRefine(suggestion)}>
                                {suggestion}
                            </Chip>
                        ))}
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void regenerate()} className="ml-auto">
                            <ArrowsClockwise />
                            Regenerate
                        </Button>
                    </div>
                </div>

                {usedWebSearch && (
                    <div className="grid gap-2 border-t border-line pt-3">
                        <p className="flex items-center gap-1.5 text-caption text-muted">
                            <Globe className="size-3.5" />
                            Researched on the web
                        </p>
                        {sources.length > 0 && (
                            <ul className="grid gap-1">
                                {sources.map((source) => (
                                    <li key={source.url}>
                                        <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="focus-ring inline-flex max-w-full items-center gap-1.5 rounded-[4px] text-caption text-accent underline-offset-2 hover:underline"
                                        >
                                            <span className="truncate">{source.title ?? hostOf(source.url)}</span>
                                            <span className="shrink-0 text-subtle">{hostOf(source.url)}</span>
                                            <ArrowSquareOut className="size-3 shrink-0" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </Card>
        </motion.div>
    );
}
