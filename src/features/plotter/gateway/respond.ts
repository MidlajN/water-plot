import { NextResponse } from "next/server";

import { GatewayError } from "./client";

export const NO_STORE = { "Cache-Control": "no-store" };

export function jsonError(error: string, status: number) {
    return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** Turns a failed gateway call into an API response. */
export function gatewayErrorResponse(error: unknown) {
    if (error instanceof GatewayError) return jsonError(error.message, error.status);
    console.error("[Plotter API]", error);
    return jsonError("Something went wrong talking to the plotter.", 500);
}

/** Reads a JSON object body, or returns null if it isn't one. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const body = await request.json();
        return body && typeof body === "object" && !Array.isArray(body) ? body : null;
    } catch {
        return null;
    }
}
