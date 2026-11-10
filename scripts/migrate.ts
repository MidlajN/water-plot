import "dotenv/config";

import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db, sqlite } from "../src/lib/db";

/**
 * Applies pending database migrations from ./drizzle (relative to the working
 * directory). Already-applied migrations are skipped, so it is safe to run on every
 * start. Used by the Pi bundle, where drizzle-kit isn't installed.
 */
const migrationsFolder = path.resolve(process.cwd(), "drizzle");

try {
    migrate(db, { migrationsFolder });
    console.log(`[Migrate] Database is up to date (${migrationsFolder})`);
} catch (error) {
    console.error("[Migrate] Failed:", error);
    process.exitCode = 1;
} finally {
    sqlite.close();
}
