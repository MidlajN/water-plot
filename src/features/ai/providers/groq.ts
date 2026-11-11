import "server-only";

import Groq, { APIConnectionTimeoutError, APIError } from "groq-sdk";

import type { AiConfig } from "../config";
import { RESEARCH_INSTRUCTIONS } from "../prompts";
import { MODEL_DESIGN_JSON_SCHEMA, type ModelDesign } from "../schema";
import {
    DESIGN_TIMEOUT_MS,
    DesignError,
    RESEARCH_MAX_TOKENS,
    RESEARCH_TIMEOUT_MS,
    SourceList,
    TOO_DETAILED,
    TOO_SLOW,
    errorForStatus,
    parseDesign,
    type DesignProvider,
    type Research,
} from "./shared";

type Message = Groq.Chat.ChatCompletionMessage;

/** Structured output mode: strict JSON Schema, or JSON mode for models without it. */
let strictUnsupported = false;

const errorCode = (error: APIError) => (error.error as { error?: { code?: string } } | undefined)?.error?.code;

/** Titles and URLs from Groq's built-in browser search results. */
function collectSources(message: Message) {
    const sources = new SourceList();
    for (const tool of message.executed_tools ?? []) {
        for (const result of tool.browser_results ?? []) sources.add(result.url, result.title);
        for (const result of tool.search_results?.results ?? []) sources.add(result.url, result.title);
    }
    return sources.list();
}

/** Groq (OpenAI-compatible chat completions, e.g. openai/gpt-oss-120b). */
export function createGroqProvider(config: AiConfig): DesignProvider {
    // groq-sdk adds the /openai/v1 path itself, so it takes the host part of the
    // documented endpoint (https://api.groq.com/openai/v1 → https://api.groq.com).
    const baseURL = config.baseUrl?.replace(/\/openai\/v1$/, "");
    const client = new Groq({ apiKey: config.apiKey, baseURL, maxRetries: 1 });

    /**
     * Groq's browser_search tool can't be combined with structured output, so facts are
     * gathered in a separate call and passed to the design call as notes.
     */
    async function research(prompt: string): Promise<Research> {
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

    async function design(instructions: string, input: string): Promise<ModelDesign> {
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
                { timeout: DESIGN_TIMEOUT_MS },
            );

        let completion: Groq.Chat.ChatCompletion;
        try {
            completion = await request(!strictUnsupported);
        } catch (error) {
            // Groq rejects output that doesn't match the schema ("json_validate_failed"); try once more.
            if (error instanceof APIError && errorCode(error) === "json_validate_failed") {
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
        if (usage) console.info(`[AI] Groq design tokens: ${usage.prompt_tokens} in, ${usage.completion_tokens} out, id ${completion.id}`);
        if (choice?.finish_reason === "length") {
            console.warn(`[AI] Output hit the token limit, id ${completion.id}`);
            throw new DesignError(TOO_DETAILED, 502);
        }
        return parseDesign(choice?.message.content, completion.id);
    }

    function mapError(error: unknown): DesignError | null {
        if (error instanceof APIConnectionTimeoutError) return new DesignError(TOO_SLOW, 504);
        if (!(error instanceof APIError)) return null;
        const code = errorCode(error);
        console.warn(`[AI] Groq error ${error.status ?? "(no status)"}${code ? ` (${code})` : ""}`);
        return errorForStatus(error.status, "GROQ_MODEL");
    }

    return { name: "groq", research, design, mapError };
}
