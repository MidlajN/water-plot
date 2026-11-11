import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";

export const autoSettings = sqliteTable("auto_settings", {
    id: integer("id").primaryKey(),
    enabled: integer("enabled", { mode: "boolean" })
        .notNull()
        .default(false),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    updatedAt: text("updated_at")
        .notNull()
        .$defaultFn(() => new Date().toISOString()),
});

export const plotJobs = sqliteTable("plot_jobs", {
        id: integer("id").primaryKey({ autoIncrement: true }),
        scheduledAt: text("scheduled_at").notNull().unique(),
        status: text("status", { enum: ["pending", "running", "completed", "failed", "skipped"], }).notNull().default("pending"),
        quote: text("quote"),
        error: text("error"),
        startedAt: text("started_at"),
        completedAt: text("completed_at"),
        createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
        svgPath: text("svg_path"),
        /** Job id on the Pi gateway once the plot was sent. */
        gatewayJobId: text("gateway_job_id"),
    }, (table) => [index("plot_jobs_status_idx").on(table.status)],
);
/** SVGs people uploaded to Elements. The file is data/uploads/<id>.svg (sanitized line art). */
export const svgUploads = sqliteTable("svg_uploads", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: text("created_at")
        .notNull()
        .$defaultFn(() => new Date().toISOString()),
});
