DROP TABLE IF EXISTS `users`;--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`avatar_color` text DEFAULT '#6366f1' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_user_id_unique` ON `players` (`user_id`);--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_slug` text NOT NULL,
	`status` text DEFAULT 'setup' NOT NULL,
	`current_round` integer DEFAULT 0 NOT NULL,
	`current_player_index` integer DEFAULT 0 NOT NULL,
	`config` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_session_id` integer NOT NULL REFERENCES `game_sessions`(`id`) ON DELETE cascade,
	`player_id` integer NOT NULL REFERENCES `players`(`id`),
	`player_order` integer NOT NULL,
	`current_score` integer DEFAULT 0 NOT NULL,
	`game_state` text,
	`is_winner` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_session_player_unique` ON `game_players` (`game_session_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_session_order_unique` ON `game_players` (`game_session_id`,`player_order`);--> statement-breakpoint
CREATE INDEX `game_players_player_id_idx` ON `game_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `game_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_session_id` integer NOT NULL REFERENCES `game_sessions`(`id`) ON DELETE cascade,
	`player_id` integer NOT NULL REFERENCES `players`(`id`),
	`round_number` integer NOT NULL,
	`darts` text NOT NULL,
	`score_delta` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_turns_session_round_idx` ON `game_turns` (`game_session_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `game_turns_player_id_idx` ON `game_turns` (`player_id`);
