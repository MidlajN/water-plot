import { NextResponse, connection } from "next/server";

import {
    getAutoSettings,
    isValidTimeZone,
    updateAutoSettings,
    type AutoSettingsPatch,
} from "@/features/auto/settings";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/auto: the Auto mode settings ({ enabled, timezone, updatedAt }). */
export async function GET() {
    // The SQLite driver is synchronous; without this the query would run once at prerender.
    await connection();
    return NextResponse.json(getAutoSettings(), { headers: NO_STORE });
}

/**
 * PUT /api/auto: turns Auto mode on or off and/or changes its time zone.
 * Body: { enabled?: boolean, timezone?: string }. Returns the updated settings.
 */
export async function PUT(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return badRequest("Body must be JSON.");
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return badRequest("Body must be a JSON object.");
    }

    const { enabled, timezone } = body as Record<string, unknown>;
    const patch: AutoSettingsPatch = {};

    if (enabled !== undefined) {
        if (typeof enabled !== "boolean") return badRequest("enabled must be true or false.");
        patch.enabled = enabled;
    }

    if (timezone !== undefined) {
        if (typeof timezone !== "string" || !isValidTimeZone(timezone)) {
            return badRequest("timezone must be an IANA time zone name, e.g. Asia/Kolkata.");
        }
        patch.timezone = timezone;
    }

    if (Object.keys(patch).length === 0) return badRequest("Nothing to update: send enabled and/or timezone.");

    return NextResponse.json(updateAutoSettings(patch), { headers: NO_STORE });
}

function badRequest(error: string) {
    return NextResponse.json({ error }, { status: 400, headers: NO_STORE });
}
