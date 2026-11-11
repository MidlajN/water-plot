"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { ENGINE_LABELS, LIMITS, isImageEngine, type DesignCategory, type DesignEngine } from "./constants";
import type { Box, Design, DesignResponse, Source } from "./schema";

export type CategoryChoice = DesignCategory | "auto";

export const CATEGORY_CHOICES: ReadonlyArray<{ id: CategoryChoice; label: string }> = [
    { id: "auto", label: "Auto" },
    { id: "poetry", label: "Poetry" },
    { id: "line_art", label: "Line art" },
    { id: "combination", label: "Combination" },
    { id: "custom", label: "Custom" },
];

export const CATEGORY_LABEL: Record<DesignCategory, string> = {
    poetry: "Poetry",
    line_art: "Line art",
    combination: "Combination",
    custom: "Custom",
};

export const EXAMPLE_PROMPTS: ReadonlyArray<{ prompt: string; category: CategoryChoice }> = [
    { prompt: "A minimal flower illustration", category: "line_art" },
    { prompt: "A two-line poem about nature", category: "poetry" },
    { prompt: "A continuous-line cat illustration", category: "line_art" },
    { prompt: "A mountain illustration with a short quote", category: "combination" },
];

export interface EngineChoice {
    id: DesignEngine;
    label: string;
}

/** Until the server says which image engines it has, only the vector engine is offered. */
const VECTOR_ONLY: EngineChoice[] = [{ id: "vector", label: ENGINE_LABELS.vector }];

export const REFINEMENT_SUGGESTIONS = ["Make it more minimal", "Simplify the lines", "Add more detail", "Increase the spacing"] as const;

/** One generated design; Regenerate and Refine add new versions. */
export interface DesignVersion {
    design: Design;
    sources: Source[];
    usedWebSearch: boolean;
    /** The request it was made from (the original prompt for refinements). */
    prompt: string;
    category: CategoryChoice;
    /** What drew it; Regenerate and Refine use the same engine. */
    engine: DesignEngine;
    /** The refinement that produced it, if any. */
    refinement?: string;
}

type Action = "generate" | "regenerate" | "refine";

export type StudioActivity =
    | { status: "idle" }
    | { status: "working"; action: Action; startedAt: number; engine: DesignEngine }
    | { status: "clarification"; question: string; suggestions: string[] }
    | { status: "error"; action: Action; message: string; canRetry: boolean };

interface AiStudioValue {
    prompt: string;
    setPrompt: (prompt: string) => void;
    category: CategoryChoice;
    setCategory: (category: CategoryChoice) => void;
    /** Engines this server offers (the vector engine, plus image engines with a key set). */
    engines: EngineChoice[];
    engine: DesignEngine;
    /** Choosing an image engine also picks Line art, the only kind it makes. */
    setEngine: (engine: DesignEngine) => void;
    activity: StudioActivity;
    busy: boolean;
    versions: DesignVersion[];
    /** Index of the version on show. */
    index: number;
    current: DesignVersion | null;
    showVersion: (index: number) => void;
    /** New design from the prompt box (or the text given), replacing earlier versions. */
    generate: (prompt?: string) => Promise<void>;
    /** Another take on the current version's prompt, kept as a new version. */
    regenerate: () => Promise<void>;
    /** A new version of the current design with the refinement applied. */
    refine: (refinement: string) => Promise<void>;
    /** Sends the last failed request again. */
    retry: () => void;
    cancel: () => void;
    dismiss: () => void;
}

const AiStudioContext = createContext<AiStudioValue | null>(null);

/** Client timeout; the server allows up to ~150 s when a web research step runs. */
const CLIENT_TIMEOUT_MS = 180_000;

interface RequestBody {
    mode: "generate" | "refine";
    prompt: string;
    category: CategoryChoice;
    engine: DesignEngine;
    refinement?: string;
    previous?: {
        title: string;
        category: DesignCategory;
        text: { lines: string[]; font: string; box: Box } | null;
        illustration: Design["illustration"];
    };
}

/**
 * AI Creative Studio state shared by the desktop viewer and sidebar and the phone card:
 * the prompt, the category, the generated versions and what's happening now. One
 * request runs at a time. Nothing here touches the canvas; designs are added to the
 * workspace only when the user approves one.
 */
export function AiStudioProvider({ children }: PropsWithChildren) {
    const [prompt, setPrompt] = useState("");
    const [category, setCategory] = useState<CategoryChoice>("auto");
    const [engines, setEngines] = useState<EngineChoice[]>(VECTOR_ONLY);
    const [engine, setEngineState] = useState<DesignEngine>("vector");
    const [activity, setActivity] = useState<StudioActivity>({ status: "idle" });
    const [versions, setVersions] = useState<DesignVersion[]>([]);
    const [index, setIndex] = useState(0);
    const controller = useRef<AbortController | null>(null);
    const lastRequest = useRef<{ action: Action; body: RequestBody; refinement?: string } | null>(null);

    useEffect(() => {
        const abort = new AbortController();
        fetch("/api/ai/engines", { signal: abort.signal })
            .then((response) => (response.ok ? response.json() : null))
            .then((body: { engines?: EngineChoice[] } | null) => {
                const listed = body?.engines?.filter((choice) => choice.id in ENGINE_LABELS);
                if (!listed?.length) return;
                setEngines(listed);
                setEngineState((current) => (listed.some((choice) => choice.id === current) ? current : "vector"));
            })
            .catch(() => {
                // Offline or aborted: keep the vector engine only.
            });
        return () => abort.abort();
    }, []);

    const setEngine = useCallback((next: DesignEngine) => {
        setEngineState(next);
        if (isImageEngine(next)) setCategory("line_art");
    }, []);

    const run = useCallback(async (action: Action, body: RequestBody, refinement?: string) => {
        if (controller.current) return; // one request at a time
        lastRequest.current = { action, body, refinement };
        const abort = new AbortController();
        controller.current = abort;
        const timeout = setTimeout(() => abort.abort("timeout"), CLIENT_TIMEOUT_MS);
        setActivity({ status: "working", action, startedAt: Date.now(), engine: body.engine });

        const fail = (message: string) => setActivity({ status: "error", action, message, canRetry: true });

        try {
            const response = await fetch("/api/ai/design", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: abort.signal,
            });
            const result = (await response.json().catch(() => null)) as DesignResponse | null;

            if (!result) fail("The studio didn't respond properly. Try again.");
            else if (result.status === "success") {
                const version: DesignVersion = {
                    design: result.design,
                    sources: result.sources,
                    usedWebSearch: result.usedWebSearch,
                    prompt: body.prompt,
                    category: body.category,
                    engine: result.engine ?? body.engine,
                    refinement,
                };
                setVersions((current) => {
                    const next = action === "generate" ? [version] : [...current, version];
                    setIndex(next.length - 1);
                    return next;
                });
                setActivity({ status: "idle" });
            } else if (result.status === "needs_clarification") {
                setActivity({ status: "clarification", ...result.clarification });
            } else fail(result.error);
        } catch {
            if (abort.signal.reason === "cancel") setActivity({ status: "idle" });
            else if (abort.signal.reason === "timeout") fail("The design took too long. Try a simpler idea.");
            else fail("Couldn't reach the studio. Check your connection and try again.");
        } finally {
            clearTimeout(timeout);
            controller.current = null;
        }
    }, []);

    const generate = useCallback(
        async (override?: string) => {
            const text = (override ?? prompt).trim().slice(0, LIMITS.promptMax);
            if (override !== undefined) setPrompt(text);
            if (text.length < LIMITS.promptMin) {
                setActivity({ status: "error", action: "generate", message: "Describe your idea in a few words first.", canRetry: false });
                return;
            }
            await run("generate", { mode: "generate", prompt: text, category: isImageEngine(engine) ? "line_art" : category, engine });
        },
        [prompt, category, engine, run],
    );

    const current = versions[index] ?? null;

    const regenerate = useCallback(async () => {
        if (!current) return;
        await run("regenerate", { mode: "generate", prompt: current.prompt, category: current.category, engine: current.engine });
    }, [current, run]);

    const refine = useCallback(
        async (refinement: string) => {
            const instruction = refinement.trim().slice(0, LIMITS.refinementMax);
            if (!current || !instruction) return;
            const { design } = current;
            await run(
                "refine",
                {
                    mode: "refine",
                    prompt: current.prompt,
                    category: current.category,
                    engine: current.engine,
                    refinement: instruction,
                    previous: {
                        title: design.title,
                        category: design.category,
                        text: design.text ? { lines: design.text.lines, font: design.text.font, box: design.text.box } : null,
                        // An image engine draws the refined idea afresh, so the old SVG isn't sent.
                        illustration: isImageEngine(current.engine) ? null : design.illustration,
                    },
                },
                instruction,
            );
        },
        [current, run],
    );

    const retry = useCallback(() => {
        const last = lastRequest.current;
        if (last) void run(last.action, last.body, last.refinement);
    }, [run]);
    const cancel = useCallback(() => controller.current?.abort("cancel"), []);
    const dismiss = useCallback(() => setActivity((state) => (state.status === "working" ? state : { status: "idle" })), []);
    const showVersion = useCallback((next: number) => setIndex((currentIndex) => (versions[next] ? next : currentIndex)), [versions]);

    const value = useMemo<AiStudioValue>(
        () => ({
            prompt,
            setPrompt,
            category,
            setCategory,
            engines,
            engine,
            setEngine,
            activity,
            busy: activity.status === "working",
            versions,
            index,
            current,
            showVersion,
            generate,
            regenerate,
            refine,
            retry,
            cancel,
            dismiss,
        }),
        [prompt, category, engines, engine, setEngine, activity, versions, index, current, showVersion, generate, regenerate, refine, retry, cancel, dismiss],
    );

    return <AiStudioContext.Provider value={value}>{children}</AiStudioContext.Provider>;
}

export function useAiStudio() {
    const context = useContext(AiStudioContext);
    if (!context) throw new Error("useAiStudio must be used within AiStudioProvider");
    return context;
}
