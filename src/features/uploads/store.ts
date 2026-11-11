import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { svgUploads } from "@/lib/db/schema";

/**
 * Server-side store for SVGs people upload to Elements: one row per upload and the
 * sanitized line art in data/uploads/<id>.svg. Only sanitized SVG is ever written.
 */

export interface Upload {
    id: string;
    name: string;
    createdAt: string;
}

/** Most uploads kept at once (thumbnails all load in the Elements picker). */
export const MAX_UPLOADS = 200;

const UPLOADS_DIRECTORY = path.resolve(process.cwd(), "data", "uploads");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Ids are server-made UUIDs; anything else never reaches a file path. */
export const isUploadId = (id: string) => UUID.test(id);

const fileFor = (id: string) => path.join(UPLOADS_DIRECTORY, `${id}.svg`);

export function listUploads(): Upload[] {
    return db
        .select()
        .from(svgUploads)
        .orderBy(desc(svgUploads.createdAt), desc(sql`rowid`))
        .all();
}

/** Saves sanitized SVG under a new id, or returns "full" when MAX_UPLOADS are kept. */
export function saveUpload(name: string, svg: string): Upload | "full" {
    fs.mkdirSync(UPLOADS_DIRECTORY, { recursive: true });
    const id = randomUUID();
    const file = fileFor(id);
    fs.writeFileSync(file, svg, { encoding: "utf8", flag: "wx" });

    try {
        // Count and insert together, so two uploads at once can't pass the cap.
        const saved = db.transaction((tx) => {
            const count = tx.select({ count: sql<number>`count(*)` }).from(svgUploads).get()?.count ?? 0;
            if (count >= MAX_UPLOADS) return "full" as const;
            return tx.insert(svgUploads).values({ id, name }).returning().get();
        });
        if (saved === "full") fs.rmSync(file, { force: true });
        return saved;
    } catch (error) {
        fs.rmSync(file, { force: true });
        throw error;
    }
}

/** The upload's SVG, or null for an unknown id. */
export async function readUpload(id: string): Promise<string | null> {
    if (!isUploadId(id)) return null;
    try {
        return await readFile(fileFor(id), "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
}

/** Removes an upload (row, then file). Unknown ids are already gone. */
export function deleteUpload(id: string) {
    if (!isUploadId(id)) return;
    db.delete(svgUploads).where(eq(svgUploads.id, id)).run();
    fs.rmSync(fileFor(id), { force: true });
}

/**
 * A display name from the uploaded file name: no folders or .svg, no control or
 * direction-changing characters, single spaces, at most 60 characters.
 */
export function cleanUploadName(raw: string): string {
    const base = raw.split(/[\\/]/).pop() ?? "";
    const cleaned = base
        .replace(/\.svg$/i, "")
        .normalize("NFC")
        .replace(/[\p{Cc}\p{Cf}]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
    return [...cleaned].slice(0, 60).join("").trim() || "Untitled";
}
