import "server-only";

import type { PollinationsConfig } from "./config";
import { IMAGE_TIMEOUT_MS, MAX_IMAGE_BYTES, errorDetail, imageHttpError, imageNetworkError, readCapped } from "./http";

/**
 * One FLUX image from Pollinations: GET /image/{prompt}. The key goes in the
 * Authorization header (never the URL), and a random seed gives a new drawing each time.
 */
export async function pollinationsImage(config: PollinationsConfig, prompt: string): Promise<Uint8Array> {
    const params = new URLSearchParams({
        model: config.model,
        width: "1024",
        height: "1024",
        seed: String(Math.floor(Math.random() * 2_147_483_647)),
        nologo: "true",
    });
    const url = `${config.baseUrl}/image/${encodeURIComponent(prompt)}?${params}`;

    let response: Response;
    try {
        response = await fetch(url, {
            headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "image/png, image/jpeg" },
            cache: "no-store",
            signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        });
    } catch (error) {
        throw imageNetworkError("flux", error);
    }

    if (!response.ok) {
        console.warn(`[AI] Pollinations ${config.model} answered ${response.status}: ${await errorDetail(response)}`);
        throw imageHttpError("flux", response.status, "POLLINATIONS_API_KEY");
    }

    try {
        return await readCapped(response, MAX_IMAGE_BYTES);
    } catch (error) {
        throw imageNetworkError("flux", error);
    }
}
