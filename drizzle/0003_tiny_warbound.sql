PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_session_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`player_order` integer NOT NULL,
	`current_score` integer DEFAULT 0 NOT NULL,
	`game_state` text,
	`is_winner` integer DEFAULT false NOT NULL,
	`three_dart_avg` real,
	FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_game_players`("id", "game_session_id", "player_id", "player_order", "current_score", "game_state", "is_winner", "three_dart_avg") SELECT "id", "game_session_id", "player_id", "player_order", "current_score", "game_state", "is_winner", NULL FROM `game_players`;--> statement-breakpoint
DROP TABLE `game_players`;--> statement-breakpoint
ALTER TABLE `__new_game_players` RENAME TO `game_players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_session_player_unique` ON `game_players` (`game_session_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_session_order_unique` ON `game_players` (`game_session_id`,`player_order`);--> statement-breakpoint
CREATE INDEX `game_players_player_id_idx` ON `game_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `__new_game_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_session_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`round_number` integer NOT NULL,
	`darts` text NOT NULL,
	`score_delta` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`game_session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_game_turns`("id", "game_session_id", "player_id", "round_number", "darts", "score_delta", "created_at") SELECT "id", "game_session_id", "player_id", "round_number", "darts", "score_delta", "created_at" FROM `game_turns`;--> statement-breakpoint
DROP TABLE `game_turns`;--> statement-breakpoint
ALTER TABLE `__new_game_turns` RENAME TO `game_turns`;--> statement-breakpoint
CREATE INDEX `game_turns_session_round_idx` ON `game_turns` (`game_session_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `game_turns_player_id_idx` ON `game_turns` (`player_id`);