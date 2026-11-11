import "server-only";

import { DesignError } from "../providers/shared";
import type { OpenAiImageConfig } from "./config";
import { IMAGE_TIMEOUT_MS, MAX_IMAGE_BYTES, errorDetail, imageHttpError, imageNetworkError } from "./http";

/** Base64 of MAX_IMAGE_BYTES, plus JSON around it. */
const MAX_RESPONSE_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64 * 1024;

async function request(config: OpenAiImageConfig, body: Record<string, unknown>) {
    try {
        return await fetch(`${config.baseUrl}/images/generations`, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        });
    } catch (error) {
        throw imageNetworkError("openai", error);
    }
}

/**
 * One PNG from the OpenAI Images API (gpt-image models; they answer with base64).
 * If the model doesn't take the `complexity` setting, the request is retried once
 * without it.
 */
export async function openAiImage(config: OpenAiImageConfig, prompt: string): Promise<Uint8Array> {
    const body: Record<string, unknown> = {
        model: config.model,
        prompt,
        n: 1,
        size: "1024x1024",
        quality: config.quality,
        output_format: "png",
    };
    if (config.complexity) body.complexity = config.complexity;

    let response = await request(config, body);
    if (response.status === 400 && body.complexity) {
        const detail = await errorDetail(response.clone());
        if (/complexity/i.test(detail)) {
            console.warn(`[AI] OpenAI ${config.model} doesn't take complexity; retrying without it (set OPENAI_IMAGE_COMPLEXITY=none).`);
            delete body.complexity;
            response = await request(config, body);
        }
    }

    if (!response.ok) {
        console.warn(`[AI] OpenAI ${config.model} answered ${response.status}: ${await errorDetail(response)}`);
        throw imageHttpError("openai", response.status, "OPENAI_API_KEY");
    }

    let base64: unknown;
    try {
        const text = await response.text();
        if (text.length > MAX_RESPONSE_CHARS) throw new DesignError("The image service sent an image that's too large.", 502);
        base64 = JSON.parse(text)?.data?.[0]?.b64_json;
    } catch (error) {
        if (error instanceof DesignError) throw error;
        throw imageNetworkError("openai", error);
    }
    if (typeof base64 !== "string" || !base64) {
        console.warn(`[AI] OpenAI ${config.model} answered without an image`);
        throw new DesignError("OpenAI couldn't make an image this time. Try again.", 502);
    }
    return new Uint8Array(Buffer.from(base64, "base64"));
}
