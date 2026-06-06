ALTER TABLE `game_sessions` ADD `cloud_sync_status` text DEFAULT 'unsynced' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `cloud_session_id` text;