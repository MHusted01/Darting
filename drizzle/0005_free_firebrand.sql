ALTER TABLE `game_players` ADD `analytics` text;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `context` text DEFAULT 'casual' NOT NULL;