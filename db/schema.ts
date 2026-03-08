import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const players = sqliteTable(
  'players',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    userId: text('user_id'),
    avatarColor: text('avatar_color').notNull().default('#6366f1'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex('players_user_id_unique').on(table.userId)],
);

export const gameSessions = sqliteTable('game_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameSlug: text('game_slug').notNull(),
  status: text('status', {
    enum: ['setup', 'in_progress', 'completed', 'abandoned'],
  })
    .notNull()
    .default('setup'),
  currentRound: integer('current_round').notNull().default(0),
  currentPlayerIndex: integer('current_player_index').notNull().default(0),
  config: text('config', { mode: 'json' }),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gamePlayers = sqliteTable(
  'game_players',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gameSessionId: integer('game_session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    playerOrder: integer('player_order').notNull(),
    currentScore: integer('current_score').notNull().default(0),
    gameState: text('game_state', { mode: 'json' }),
    isWinner: integer('is_winner', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    uniqueIndex('game_players_session_player_unique').on(
      table.gameSessionId,
      table.playerId,
    ),
    uniqueIndex('game_players_session_order_unique').on(
      table.gameSessionId,
      table.playerOrder,
    ),
    index('game_players_player_id_idx').on(table.playerId),
  ],
);

export const gameTurns = sqliteTable(
  'game_turns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gameSessionId: integer('game_session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    roundNumber: integer('round_number').notNull(),
    darts: text('darts', { mode: 'json' }).notNull(),
    scoreDelta: integer('score_delta').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('game_turns_session_round_idx').on(
      table.gameSessionId,
      table.roundNumber,
    ),
    index('game_turns_player_id_idx').on(table.playerId),
  ],
);

export const playersRelations = relations(players, ({ many }) => ({
  gamePlayers: many(gamePlayers),
  gameTurns: many(gameTurns),
}));

export const gameSessionsRelations = relations(gameSessions, ({ many }) => ({
  gamePlayers: many(gamePlayers),
  gameTurns: many(gameTurns),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  gameSession: one(gameSessions, {
    fields: [gamePlayers.gameSessionId],
    references: [gameSessions.id],
  }),
  player: one(players, {
    fields: [gamePlayers.playerId],
    references: [players.id],
  }),
}));

export const gameTurnsRelations = relations(gameTurns, ({ one }) => ({
  gameSession: one(gameSessions, {
    fields: [gameTurns.gameSessionId],
    references: [gameSessions.id],
  }),
  player: one(players, {
    fields: [gameTurns.playerId],
    references: [players.id],
  }),
}));
