import { NextResponse, connection } from "next/server";

import { GatewayError, getStatus } from "@/features/plotter/gateway/client";
import { NO_STORE } from "@/features/plotter/gateway/respond";

/** GET /api/plotter/status: { connected, state, mpos, job }, or { connected: false, error }. */
export async function GET() {
    await connection();

    try {
        return NextResponse.json({ connected: true, ...(await getStatus()) }, { headers: NO_STORE });
    } catch (error) {
        const message = error instanceof GatewayError ? error.message : "Can't reach the plotter.";
        return NextResponse.json({ connected: false, error: message }, { headers: NO_STORE });
    }
}
