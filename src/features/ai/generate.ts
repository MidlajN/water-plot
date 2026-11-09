import "server-only";

import Groq, { APIConnectionTimeoutError, APIError } from "groq-sdk";

import { AiConfigError, getAiConfig, type AiConfig } from "./config";
import { RESEARCH_INSTRUCTIONS, buildInput, buildInstructions, buildRepairInput } from "./prompts";
import { fitBox, sanitizeSvg } from "./sanitizeSvg";
import {
    FONT_IDS,
    MODEL_DESIGN_JSON_SCHEMA,
    ModelDesignSchema,
    type Design,
    type DesignRequest,
    type DesignResponse,
    type ModelDesign,
    type Source,
} from "./schema";
import { shouldOfferWebSearch } from "./webSearch";

const TIMEOUT_MS = 90_000;
const RESEARCH_TIMEOUT_MS = 60_000;
const RESEARCH_MAX_TOKENS = 4000;
const MAX_SOURCES = 8;

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

const FAILED = "Couldn't create a design this time. Try again.";

type Message = Groq.Chat.ChatCompletionMessage;

interface Research {
    notes: string;
    sources: Source[];
}

/** Titles and URLs from Groq's built-in browser search results. */
function collectSources(message: Message): Source[] {
    const found = new Map<string, Source>();
    const add = (url?: string, title?: string) => {
        if (!url || !/^https?:\/\//i.test(url) || found.has(url)) return;
        found.set(url, title ? { url, title } : { url });
    };

    for (const tool of message.executed_tools ?? []) {
        for (const result of tool.browser_results ?? []) add(result.url, result.title);
        for (const result of tool.search_results?.results ?? []) add(result.url, result.title);
    }
    return [...found.values()].slice(0, MAX_SOURCES);
}

/**
 * Research step: Groq's browser_search tool can't be combined with structured output,
 * so facts are gathered in a separate call and passed to the design call as notes.
 */
async function research(client: Groq, config: AiConfig, prompt: string): Promise<Research> {
    let completion: Groq.Chat.ChatCompletion;
    try {
        completion = await client.chat.completions.create(
            {
                model: config.model,
                messages: [
                    { role: "system", content: RESEARCH_INSTRUCTIONS },
                    { role: "user", content: prompt },
                ],
                tools: [{ type: "browser_search" }],
                tool_choice: "required",
                reasoning_effort: "low",
                max_completion_tokens: RESEARCH_MAX_TOKENS,
            },
            { timeout: RESEARCH_TIMEOUT_MS },
        );
    } catch (error) {
        // A model without the built-in tool answers 400: a setup problem, not a silent skip.
        if (error instanceof APIError && error.status === 400 && /tool|browser_search/i.test(error.message)) {
            console.warn(`[AI] Web search isn't supported by GROQ_MODEL (${config.model})`);
            throw new DesignError("Web search isn't available with the configured AI model. Set AI_ENABLE_WEB_SEARCH=false or use a model with browser search.", 503);
        }
        throw error;
    }

    const message = completion.choices[0]?.message;
    const sources = message ? collectSources(message) : [];
    // Strip the inline citation markers (【…】) the search results add to the text.
    const notes = (message?.content ?? "").replace(/【[^】]*】/g, "").trim();
    if (!sources.length && !notes) throw new DesignError("Web search didn't return anything usable. Try again.", 502);
    return { notes, sources };
}

/** Structured output mode: strict JSON Schema, or JSON mode for models without it. */
let strictUnsupported = false;

function parseDesign(content: string | null | undefined, id: string): ModelDesign {
    let json: unknown;
    try {
        json = JSON.parse(content ?? "");
    } catch {
        console.warn(`[AI] Response wasn't JSON, id ${id}`);
        throw new DesignError(FAILED, 502);
    }

    const parsed = ModelDesignSchema.safeParse(json);
    if (!parsed.success) {
        console.warn(`[AI] Response didn't match the schema (${parsed.error.issues[0]?.message}), id ${id}`);
        throw new DesignError(FAILED, 502);
    }
    return parsed.data;
}

async function callDesign(client: Groq, config: AiConfig, instructions: string, input: string): Promise<ModelDesign> {
    const request = (strict: boolean) =>
        client.chat.completions.create(
            {
                model: config.model,
                messages: [
                    {
                        role: "system",
                        content: strict
                            ? instructions
                            : `${instructions}\n\nReply with one JSON object that matches this JSON Schema:\n${JSON.stringify(MODEL_DESIGN_JSON_SCHEMA)}`,
                    },
                    { role: "user", content: input },
                ],
                response_format: strict
                    ? { type: "json_schema", json_schema: { name: "plotter_design", strict: true, schema: MODEL_DESIGN_JSON_SCHEMA } }
                    : { type: "json_object" },
                // Drawing well takes planning; "high" gives clearly better line art.
                reasoning_effort: "high",
                max_completion_tokens: config.maxOutputTokens,
            },
            { timeout: TIMEOUT_MS },
        );

    let completion: Groq.Chat.ChatCompletion;
    try {
        completion = await request(!strictUnsupported);
    } catch (error) {
        const code = error instanceof APIError ? (error.error as { error?: { code?: string } } | undefined)?.error?.code : undefined;
        // Groq rejects output that doesn't match the schema ("json_validate_failed"); try once more.
        if (code === "json_validate_failed") {
            console.warn("[AI] Output failed Groq's schema validation; retrying once");
            completion = await request(!strictUnsupported);
        }
        // Strict JSON Schema is model-specific on Groq; fall back to JSON mode once.
        else if (!strictUnsupported && error instanceof APIError && error.status === 400 && /json_schema|strict|response_format/i.test(error.message)) {
            console.warn(`[AI] GROQ_MODEL (${config.model}) doesn't support strict JSON Schema; using JSON mode`);
            strictUnsupported = true;
            completion = await request(false);
        } else {
            throw error;
        }
    }

    const choice = completion.choices[0];
    const usage = completion.usage;
    if (usage) console.info(`[AI] Design tokens: ${usage.prompt_tokens} in, ${usage.completion_tokens} out, id ${completion.id}`);
    if (choice?.finish_reason === "length") {
        console.warn(`[AI] Output hit the token limit, id ${completion.id}`);
        throw new DesignError("The design was too detailed to finish. Try a simpler idea.", 502);
    }
    return parseDesign(choice?.message.content, completion.id);
}

function toDesign(model: ModelDesign, config: AiConfig, illustration: Design["illustration"]): Design {
    const text = model.text
        ? {
              lines: model.text.lines.map((line) => line.trim()).filter(Boolean),
              font: model.text.font,
              fontId: FONT_IDS[model.text.font],
              box: fitBox(config.area, model.text.box),
          }
        : null;

    return {
        title: model.title!,
        description: model.description,
        category: model.category!,
        text: text && text.lines.length ? text : null,
        illustration,
        layout: { width: config.area.width, height: config.area.height, unit: "mm" },
    };
}

function mapProviderError(error: unknown): DesignError {
    if (error instanceof DesignError) return error;
    if (error instanceof AiConfigError) {
        console.warn(`[AI] ${error.message}`);
        return new DesignError("AI isn't set up on this server yet.", 503);
    }
    if (error instanceof APIConnectionTimeoutError) return new DesignError("The design took too long. Try a simpler prompt.", 504);
    if (error instanceof APIError) {
        const code = (error.error as { error?: { code?: string } } | undefined)?.error?.code;
        console.warn(`[AI] Provider error ${error.status ?? "(no status)"}${code ? ` (${code})` : ""}`);
        if (error.status === 401 || error.status === 403) return new DesignError("AI service isn't configured correctly.", 503);
        if (error.status === 404) return new DesignError("The configured AI model isn't available. Check GROQ_MODEL.", 503);
        if (error.status === 429) return new DesignError("Too many requests. Try again in a moment.", 429);
        return new DesignError(FAILED, 502);
    }
    console.warn("[AI] Unexpected error:", error instanceof Error ? error.name : typeof error);
    return new DesignError(FAILED, 502);
}

/**
 * Generates (or refines) a design: an optional web research step, one structured Groq
 * call, validation, and SVG sanitization, with one repair attempt if the SVG is
 * rejected. Returns the response body and the HTTP status to send.
 */
export async function generateDesign(request: DesignRequest): Promise<{ body: DesignResponse; status: number }> {
    const ok = (body: DesignResponse) => ({ body, status: 200 });
    try {
        const config = getAiConfig();

        // A refined design's SVG comes back from the browser: check it again before use.
        let previousSvg: string | null = null;
        if (request.mode === "refine" && request.previous?.illustration) {
            const checked = sanitizeSvg(request.previous.illustration.svg, config.area, request.previous.illustration.box);
            if (!checked.ok) throw new DesignError("The previous design couldn't be read. Start a new design.", 400);
            previousSvg = checked.svg;
        }

        // groq-sdk adds the /openai/v1 path itself, so it takes the host part of the
        // documented endpoint (https://api.groq.com/openai/v1 → https://api.groq.com).
        const baseURL = config.baseUrl.replace(/\/openai\/v1$/, "");
        const client = new Groq({ apiKey: config.apiKey, baseURL, maxRetries: 1 });
        const found = shouldOfferWebSearch(request.prompt, config.webSearchEnabled) ? await research(client, config, request.prompt) : null;
        const sources = found?.sources ?? [];
        const usedWebSearch = found !== null;

        const category = request.mode === "refine" ? request.previous!.category : request.category;
        const instructions = buildInstructions(config.area, category, Boolean(found?.notes));
        const input = buildInput(request, previousSvg, found?.notes || null);

        let design = await callDesign(client, config, instructions, input);

        for (let attempt = 0; ; attempt++) {
            if (design.status === "needs_clarification") {
                return ok({ status: "needs_clarification", clarification: design.clarification!, usedWebSearch });
            }
            if (design.status === "error") {
                return {
                    body: { status: "error", error: design.message || "That isn't something the studio can create. Try a different idea." },
                    status: 422,
                };
            }

            if (!design.illustration) {
                return ok({ status: "success", design: toDesign(design, config, null), sources, usedWebSearch });
            }

            // Without text the drawing gets the whole safe area (models tend to pick tiny
            // boxes); with text, the model's layout keeps the two apart.
            const target = design.text ? design.illustration.box : null;
            const sanitized = sanitizeSvg(design.illustration.svg, config.area, target);
            if (sanitized.ok) {
                const illustration = { svg: sanitized.svg, box: sanitized.box };
                return ok({ status: "success", design: toDesign(design, config, illustration), sources, usedWebSearch });
            }

            console.warn(`[AI] SVG rejected (${sanitized.reasons.join("; ")})${attempt === 0 ? ", retrying" : ""}`);
            if (attempt > 0) throw new DesignError("The drawing couldn't be made plotter-safe. Try again or simplify the idea.", 502);
            design = await callDesign(client, config, instructions, buildRepairInput(input, sanitized.reasons));
        }
    } catch (error) {
        const failure = mapProviderError(error);
        return { body: { status: "error", error: failure.message }, status: failure.status };
    }
}
