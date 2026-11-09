import { eq } from "drizzle-orm";

import { db } from "../../lib/db";
import { autoSettings } from "../../lib/db/schema";

/** Auto mode uses a single settings row. */
const SETTINGS_ID = 1;

export interface AutoSettings {
    enabled: boolean;
    timezone: string;
    updatedAt: string;
}

export type AutoSettingsPatch = Partial<Pick<AutoSettings, "enabled" | "timezone">>;

function toSettings({ enabled, timezone, updatedAt }: typeof autoSettings.$inferSelect): AutoSettings {
    return { enabled, timezone, updatedAt };
}

/** The Auto mode settings; creates the default row if it is missing. */
export function getAutoSettings(): AutoSettings {
    const row = db.select().from(autoSettings).where(eq(autoSettings.id, SETTINGS_ID)).get();
    if (row) return toSettings(row);

    db.insert(autoSettings).values({ id: SETTINGS_ID }).onConflictDoNothing().run();
    return toSettings(db.select().from(autoSettings).where(eq(autoSettings.id, SETTINGS_ID)).get()!);
}

/** Applies the given fields and returns the updated settings. */
export function updateAutoSettings(patch: AutoSettingsPatch): AutoSettings {
    const values = { ...patch, updatedAt: new Date().toISOString() };

    const [row] = db
        .insert(autoSettings)
        .values({ id: SETTINGS_ID, ...values })
        .onConflictDoUpdate({ target: autoSettings.id, set: values })
        .returning()
        .all();

    return toSettings(row);
}

/** Whether the runtime knows this IANA time zone name (e.g. "Asia/Kolkata"). */
export function isValidTimeZone(timeZone: string): boolean {
    try {
        new Intl.DateTimeFormat("en", { timeZone });
        return true;
    } catch {
        return false;
    }
}
