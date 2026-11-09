import { NextResponse, connection } from "next/server";

import { jog } from "@/features/plotter/gateway/client";
import { NO_STORE, gatewayErrorResponse, jsonError, readJsonObject } from "@/features/plotter/gateway/respond";
import type { JogRequest } from "@/features/plotter/gateway/types";
import { PLOTTER_PROFILE } from "@/features/plotter/profile";

const MAX_STEP_MM = 500;

/** POST /api/plotter/control/jog { x?, y?, z?, feed }: relative jog in mm. */
export async function POST(request: Request) {
    await connection();

    const body = await readJsonObject(request);
    if (!body) return jsonError("Body must be a JSON object.", 400);

    const move: JogRequest = { feed: 0 };
    for (const axis of ["x", "y", "z"] as const) {
        const value = body[axis];
        if (value === undefined || value === 0) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_STEP_MM) {
            return jsonError(`${axis} must be a number of mm up to ${MAX_STEP_MM}.`, 400);
        }
        move[axis] = value;
    }
    if (move.x === undefined && move.y === undefined && move.z === undefined) return jsonError("Nothing to move.", 400);

    const feed = body.feed;
    if (typeof feed !== "number" || !Number.isFinite(feed) || feed <= 0) return jsonError("feed must be a positive number.", 400);
    // Same Z ceiling as the G-code: any jog that moves Z is held to it.
    move.feed = Math.round(move.z !== undefined ? Math.min(feed, PLOTTER_PROFILE.zFeedMax) : feed);

    try {
        return NextResponse.json(await jog(move), { headers: NO_STORE });
    } catch (error) {
        return gatewayErrorResponse(error);
    }
}
