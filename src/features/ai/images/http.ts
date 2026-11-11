import "server-only";

import { ENGINE_LABELS, type ImageEngine } from "../constants";
import { DesignError, TOO_SLOW } from "../providers/shared";

/** Image generation is slow: allow up to 90 s per request. */
export const IMAGE_TIMEOUT_MS = 90_000;
/** Largest image accepted from a provider. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Reads a response body, refusing anything over `max` bytes without buffering it all. */
export async function readCapped(response: Response, max: number): Promise<Uint8Array> {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > max) throw new DesignError("The image service sent an image that's too large.", 502);
    if (!response.body) return new Uint8Array(await response.arrayBuffer());

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max) {
            await reader.cancel();
            throw new DesignError("The image service sent an image that's too large.", 502);
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

/** The provider's own error text, for the server log only (trimmed; never shown to users). */
export async function errorDetail(response: Response): Promise<string> {
    const text = await response.text().catch(() => "");
    try {
        const json = JSON.parse(text);
        const message = json?.error?.message ?? json?.error ?? json?.message ?? json?.detail;
        if (message) return String(typeof message === "string" ? message : JSON.stringify(message)).slice(0, 300);
    } catch {
        // Not JSON.
    }
    return text.replace(/\s+/g, " ").slice(0, 300);
}

/** Safe message and status for a failed image request. */
export function imageHttpError(engine: ImageEngine, status: number, keyVariable: string): DesignError {
    const name = ENGINE_LABELS[engine];
    if (status === 401 || status === 403) return new DesignError(`${name} isn't set up correctly on this server (check ${keyVariable}).`, 503);
    if (status === 402) return new DesignError(`${name} has no credit left on this account.`, 503);
    if (status === 429) return new DesignError(`${name} is getting too many requests. Try again in a minute.`, 429);
    if (status === 400 || status === 422) return new DesignError(`${name} couldn't draw that idea. Try rephrasing it.`, 422);
    if (status >= 500) return new DesignError(`${name} is busy right now. Try again in a minute.`, 503);
    return new DesignError(`${name} couldn't make an image this time. Try again.`, 502);
}

/** Network failure or timeout of an image request, as a safe error. */
export function imageNetworkError(engine: ImageEngine, error: unknown): DesignError {
    if (error instanceof DesignError) return error;
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") return new DesignError(TOO_SLOW, 504);
    console.warn(`[AI] ${ENGINE_LABELS[engine]} request failed: ${error instanceof Error ? error.message : String(error)}`);
    return new DesignError(`Couldn't reach ${ENGINE_LABELS[engine]}. Try again.`, 502);
}
