import { NextResponse, connection } from "next/server";

import { sanitizeUploadSvg } from "@/features/ai/sanitizeSvg";
import { readSvgRequest } from "@/features/export/readSvgRequest";
import { UPLOAD_MAX_BYTES, uploadFailureMessage } from "@/features/uploads/messages";
import { MAX_UPLOADS, cleanUploadName, listUploads, saveUpload } from "@/features/uploads/store";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/uploads: the uploaded SVGs, newest first ({ uploads: { id, name, createdAt }[] }). */
export async function GET() {
    await connection();
    return NextResponse.json({ uploads: listUploads() }, { headers: NO_STORE });
}

/**
 * POST /api/uploads?name=<file name>
 *
 * Body: one SVG (`image/svg+xml`, up to 2 MB). It's turned into plotter line art and
 * saved. Returns 201 { upload, notes } (notes: what was left out), or { error } with a
 * message ready to show: 413/415/400 for the body, 422 when the drawing can't be used,
 * 409 when MAX_UPLOADS are kept.
 */
export async function POST(request: Request) {
    const name = cleanUploadName(new URL(request.url).searchParams.get("name") ?? "");
    const body = await readSvgRequest(request, { maxBytes: UPLOAD_MAX_BYTES });
    if (!body.ok) return body.response;

    const result = sanitizeUploadSvg(body.svg);
    if (!result.ok) return NextResponse.json({ error: uploadFailureMessage(name, result) }, { status: 422, headers: NO_STORE });

    const saved = saveUpload(name, result.svg);
    if (saved === "full") {
        return NextResponse.json({ error: `You already have ${MAX_UPLOADS} uploads. Remove some to add more.` }, { status: 409, headers: NO_STORE });
    }

    return NextResponse.json({ upload: saved, notes: result.notes }, { status: 201, headers: NO_STORE });
}
