import "server-only";

import type { ImageEngine } from "../constants";

/**
 * Settings for the image engines, from the environment. An engine is available only
 * when its key is set; keys stay on the server.
 *
 * - FLUX via Pollinations: POLLINATIONS_API_KEY (a secret `sk_` key; `pk_` keys are
 *   refused by Pollinations for API calls), POLLINATIONS_IMAGE_MODEL (default flux).
 * - OpenAI: OPENAI_API_KEY, OPENAI_IMAGE_MODEL (default gpt-image-2.6-flare; DALL·E was
 *   retired from the API in May 2026), OPENAI_IMAGE_QUALITY (default low) and
 *   OPENAI_IMAGE_COMPLEXITY (default low; "none" leaves it out). Billed per token.
 */

export interface PollinationsConfig {
    engine: "flux";
    apiKey: string;
    model: string;
    baseUrl: string;
}

export interface OpenAiImageConfig {
    engine: "openai";
    apiKey: string;
    model: string;
    quality: string;
    complexity: string | null;
    baseUrl: string;
}

export type ImageEngineConfig = PollinationsConfig | OpenAiImageConfig;

const env = (name: string) => process.env[name]?.trim() || undefined;
const QUALITIES = new Set(["low", "medium", "high", "xhigh", "max", "auto"]);
const COMPLEXITIES = new Set(["low", "medium", "high"]);

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[AI] ${message}`);
}

export function getImageEngineConfig(engine: ImageEngine): ImageEngineConfig | null {
    if (engine === "flux") {
        const apiKey = env("POLLINATIONS_API_KEY");
        if (!apiKey) return null;
        if (apiKey.startsWith("pk_")) {
            warnOnce("pk", "POLLINATIONS_API_KEY is a publishable pk_ key; Pollinations only accepts secret sk_ keys for API calls, so FLUX is off.");
            return null;
        }
        return {
            engine,
            apiKey,
            model: env("POLLINATIONS_IMAGE_MODEL") ?? "flux",
            baseUrl: (env("POLLINATIONS_BASE_URL") ?? "https://gen.pollinations.ai").replace(/\/+$/, ""),
        };
    }

    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) return null;

    let quality = env("OPENAI_IMAGE_QUALITY")?.toLowerCase() ?? "low";
    if (!QUALITIES.has(quality)) {
        warnOnce("quality", `OPENAI_IMAGE_QUALITY "${quality}" isn't one of ${[...QUALITIES].join(", ")}; using low.`);
        quality = "low";
    }
    let complexity: string | null = env("OPENAI_IMAGE_COMPLEXITY")?.toLowerCase() ?? "low";
    if (complexity === "none") complexity = null;
    else if (!COMPLEXITIES.has(complexity)) {
        warnOnce("complexity", `OPENAI_IMAGE_COMPLEXITY "${complexity}" isn't low, medium, high or none; using low.`);
        complexity = "low";
    }

    return {
        engine,
        apiKey,
        model: env("OPENAI_IMAGE_MODEL") ?? "gpt-image-2.6-flare",
        quality,
        complexity,
        baseUrl: (env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
    };
}

/** The image engines with a key set, in picker order. */
export function availableImageEngines(): ImageEngine[] {
    return (["flux", "openai"] as const).filter((engine) => getImageEngineConfig(engine) !== null);
}
