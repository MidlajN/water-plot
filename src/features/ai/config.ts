import "server-only";

import { z } from "zod";

/** AI configuration error: the feature is unavailable until the environment is fixed. */
export class AiConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AiConfigError";
    }
}

const booleanFlag = z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => ["1", "true", "yes", "on"].includes(value));

const EnvSchema = z.object({
    GROQ_API_KEY: z.string().trim().min(1, "GROQ_API_KEY is not set"),
    GROQ_BASE_URL: z.url("GROQ_BASE_URL must be a URL"),
    GROQ_MODEL: z.string().trim().min(1, "GROQ_MODEL is not set"),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(64_000),
    AI_ENABLE_WEB_SEARCH: booleanFlag.default(false),
    AI_SVG_WIDTH_MM: z.coerce.number().positive().max(5000),
    AI_SVG_HEIGHT_MM: z.coerce.number().positive().max(5000),
});

export interface AiConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxOutputTokens: number;
    webSearchEnabled: boolean;
    /** Plotter working area in mm. */
    area: { width: number; height: number };
}

let warnedAboutKey = false;

/** Reads and validates the AI settings from the environment (server only). */
export function getAiConfig(): AiConfig {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
        const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))].join(", ");
        throw new AiConfigError(`AI settings missing or invalid: ${fields}`);
    }

    const env = parsed.data;
    if (!warnedAboutKey && !env.GROQ_API_KEY.startsWith("gsk_")) {
        warnedAboutKey = true;
        console.warn("[AI] GROQ_API_KEY doesn't look like a Groq key (expected the gsk_ prefix).");
    }

    return {
        apiKey: env.GROQ_API_KEY,
        baseUrl: env.GROQ_BASE_URL.replace(/\/+$/, ""),
        model: env.GROQ_MODEL,
        maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
        webSearchEnabled: env.AI_ENABLE_WEB_SEARCH,
        area: { width: env.AI_SVG_WIDTH_MM, height: env.AI_SVG_HEIGHT_MM },
    };
}
