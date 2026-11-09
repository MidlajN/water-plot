import { NextResponse, connection } from "next/server";

import { abort, hold, resume } from "@/features/plotter/gateway/client";
import { NO_STORE, gatewayErrorResponse, jsonError } from "@/features/plotter/gateway/respond";

const ACTIONS = { hold, resume, abort } as const;

/** POST /api/plotter/control/hold | resume | abort: real-time machine control. */
export async function POST(_request: Request, ctx: RouteContext<"/api/plotter/control/[action]">) {
    await connection();

    const { action } = await ctx.params;
    if (!Object.hasOwn(ACTIONS, action)) return jsonError("Unknown control action.", 404);

    try {
        return NextResponse.json(await ACTIONS[action as keyof typeof ACTIONS](), { headers: NO_STORE });
    } catch (error) {
        return gatewayErrorResponse(error);
    }
}
