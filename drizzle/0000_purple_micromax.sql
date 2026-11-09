CREATE TABLE `auto_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plot_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scheduled_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`quote` text,
	`error` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plot_jobs_scheduled_at_unique` ON `plot_jobs` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `plot_jobs_status_idx` ON `plot_jobs` (`status`);--> statement-breakpoint

INSERT OR IGNORE INTO auto_settings (
	id,
	enabled,
	timezone,
	updated_at
)
VALUES (
	1,
	0,
	'Asia/Kolkata',
	CURRENT_TIMESTAMP
);