import { NextResponse, connection } from "next/server";

import { generateDesign } from "@/features/ai/generate";
import { DesignRequestSchema } from "@/features/ai/schema";

const MAX_BODY_BYTES = 256 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

const fail = (error: string, status: number) => NextResponse.json({ status: "error", error }, { status, headers: NO_STORE });

/**
 * POST /api/ai/design
 *
 * Body (JSON): { mode: "generate" | "refine", prompt, category?, refinement?, previous? }.
 * Returns a validated, plotter-safe design, a clarification question, or an error.
 * Calls Groq on the server; the API key never reaches the browser.
 */
export async function POST(request: Request) {
    await connection();

    if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
        return fail("Content-Type must be application/json.", 415);
    }
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return fail("Request is too large.", 413);

    let raw: string;
    try {
        raw = await request.text();
    } catch {
        return fail("Couldn't read the request.", 400);
    }
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return fail("Request is too large.", 413);

    let body: unknown;
    try {
        body = JSON.parse(raw);
    } catch {
        return fail("Request body must be JSON.", 400);
    }

    const parsed = DesignRequestSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue?.path.join(".") || "request";
        return fail(`Invalid ${field}: ${issue?.message ?? "check the request"}.`, 400);
    }

    const { body: result, status } = await generateDesign(parsed.data);
    return NextResponse.json(result, { status, headers: NO_STORE });
}
