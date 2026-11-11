import "server-only";

import { ModelDesignSchema, type ModelDesign, type Source } from "../schema";

export const DESIGN_TIMEOUT_MS = 90_000;
export const RESEARCH_TIMEOUT_MS = 60_000;
export const RESEARCH_MAX_TOKENS = 4000;
export const MAX_SOURCES = 8;

/** A failure safe to show the user, with the HTTP status to answer with. */
export class DesignError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = "DesignError";
    }
}

export const FAILED = "Couldn't create a design this time. Try again.";
export const TOO_DETAILED = "The design was too detailed to finish. Try a simpler idea.";
export const TOO_SLOW = "The design took too long. Try a simpler prompt.";

/** Facts gathered by the web research step, passed to the design call as notes. */
export interface Research {
    notes: string;
    sources: Source[];
}

/** One AI service that can research a prompt and return a structured design. */
export interface DesignProvider {
    readonly name: "gemini" | "groq";
    /**
     * Web research step: short plain-text notes plus the pages they came from, or null
     * when the provider can't search on this key (the design then runs without it).
     */
    research(prompt: string): Promise<Research | null>;
    /** Structured design call, validated against ModelDesignSchema. */
    design(instructions: string, input: string): Promise<ModelDesign>;
    /** Turns this provider's SDK errors into safe messages; null when the error isn't one of them. */
    mapError(error: unknown): DesignError | null;
}

/** Collects http(s) sources without duplicates, up to MAX_SOURCES. */
export class SourceList {
    private readonly found = new Map<string, Source>();

    add(url?: string | null, title?: string | null) {
        if (!url || !/^https?:\/\//i.test(url) || this.found.has(url) || this.found.size >= MAX_SOURCES) return;
        this.found.set(url, title ? { url, title } : { url });
    }

    list(): Source[] {
        return [...this.found.values()];
    }
}

/** Parses and validates the model's JSON reply. `id` is the provider's request id, for logs. */
export function parseDesign(content: string | null | undefined, id: string | undefined): ModelDesign {
    let json: unknown;
    try {
        json = JSON.parse(content ?? "");
    } catch {
        console.warn(`[AI] Response wasn't JSON${id ? `, id ${id}` : ""}`);
        throw new DesignError(FAILED, 502);
    }

    const parsed = ModelDesignSchema.safeParse(json);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        console.warn(`[AI] Response didn't match the schema (${issue?.path.join(".") || "root"}: ${issue?.message})${id ? `, id ${id}` : ""}`);
        throw new DesignError(FAILED, 502);
    }
    return parsed.data;
}

/** The safe answer for an HTTP status from any provider. */
export function errorForStatus(status: number | undefined, modelVariable: string): DesignError {
    if (status === 401 || status === 403) return new DesignError("AI service isn't configured correctly.", 503);
    if (status === 404) return new DesignError(`The configured AI model isn't available. Check ${modelVariable}.`, 503);
    if (status === 429) return new DesignError("Too many requests. Try again in a moment.", 429);
    if (status === 503) return new DesignError("The AI service is busy right now. Try again in a minute.", 503);
    return new DesignError(FAILED, 502);
}
