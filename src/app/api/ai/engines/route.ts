import { NextResponse, connection } from "next/server";

import { ENGINE_LABELS, type DesignEngine } from "@/features/ai/constants";
import { availableImageEngines } from "@/features/ai/images/config";

/**
 * GET /api/ai/engines
 *
 * The design engines this server can use, for the AI Studio picker: the vector engine
 * always, plus each image engine whose key is set. No keys or settings are returned.
 */
export async function GET() {
    // Read the environment at request time, not at build time.
    await connection();

    const engines: DesignEngine[] = ["vector", ...availableImageEngines()];
    return NextResponse.json(
        { engines: engines.map((id) => ({ id, label: ENGINE_LABELS[id] })) },
        { headers: { "Cache-Control": "no-store" } },
    );
}
