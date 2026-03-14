import { asc, max } from 'drizzle-orm';
import { GAMES } from '@/constants/games';
import { db } from '@/db/client';
import { gamePlayers, gameTurns } from '@/db/schema';

const GAME_NAMES = new Map(GAMES.map((game) => [game.slug, game.name] as const));

export type HistorySessionStatus =
  | 'setup'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

export interface HistorySessionItem {
  sessionId: number;
  gameSlug: string;
  gameName: string;
  status: HistorySessionStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date;
  playerCount: number;
  playerNames: string[];
  playerIds: number[];
  currentRound: number;
  winnerName: string | null;
  winnerPlayerId: number | null;
}

export interface HistoryQuickStats {
  gamesPlayed: number;
  completedCount: number;
  winRate: number;
  inProgressSessions: number;
  abandonedSessions: number;
}

export interface HistoryData {
  sessions: HistorySessionItem[];
  quickStats: HistoryQuickStats;
}

/**
 * Determine the most recent activity timestamp for a session.
 *
 * @param startedAt - The session's start time, or `null` if not started
 * @param completedAt - The session's completion time, or `null` if not completed
 * @param latestTurnAt - The timestamp of the most recent turn, or `null` if none
 * @param createdAt - The session record creation time (used as a final fallback)
 * @returns `completedAt` if present, otherwise `latestTurnAt` if present, otherwise `startedAt` if present, otherwise `createdAt`
 */
function getLastActivityAt(
  startedAt: Date | null,
  completedAt: Date | null,
  latestTurnAt: Date | null,
  createdAt: Date,
): Date {
  if (completedAt) return completedAt;
  if (latestTurnAt) return latestTurnAt;
  if (startedAt) return startedAt;
  return createdAt;
}

/**
 * Normalize a session status string to a valid HistorySessionStatus, defaulting to 'abandoned' for unrecognized values.
 *
 * @param status - The input status string to normalize.
 * @returns One of `setup`, `in_progress`, `completed`, or `abandoned`; returns `abandoned` when the input is not a known status.
 */
function normalizeSessionStatus(status: string): HistorySessionStatus {
  if (
    status === 'setup' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'abandoned'
  ) {
    return status;
  }

  return 'abandoned';
}

/**
 * Normalize various representations of a timestamp into a Date or `null`.
 *
 * Accepts a Date, a numeric Unix timestamp (seconds), a numeric string (seconds), or a date string.
 *
 * @param value - The value to normalize; may be a Date, number (seconds), string, or `null`.
 * @returns A Date representing the same instant, or `null` if `value` is falsy or cannot be parsed.
 */
function normalizeLatestTurnAt(value: Date | string | number | null): Date | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value * 1000);
  }

  const trimmedValue = value.trim();
  if (trimmedValue === '') return null;
  const numericValue = Number(trimmedValue);
  if (!Number.isNaN(numericValue)) {
    return new Date(numericValue * 1000);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

/**
 * Compute aggregate statistics for a list of history sessions.
 *
 * @param sessions - Array of session items to derive statistics from
 * @returns An object with aggregate counts and percentages:
 * - `gamesPlayed`: total number of sessions
 * - `wins`: number of sessions with status `completed`
 * - `winRate`: percentage of wins across all sessions, rounded to the nearest integer
 * - `inProgressSessions`: number of sessions with status `in_progress`
 * - `abandonedSessions`: number of sessions with status `abandoned`
 */
function buildQuickStats(sessions: HistorySessionItem[]): HistoryQuickStats {
  const completedSessions = sessions.filter(
    (session) => session.status === 'completed',
  );
  const inProgressSessions = sessions.filter(
    (session) => session.status === 'in_progress',
  ).length;
  const abandonedSessions = sessions.filter(
    (session) => session.status === 'abandoned',
  ).length;
  const gamesPlayed = sessions.length;
  const completedCount = completedSessions.length;
  const winRate = gamesPlayed > 0 ? Math.round((completedCount / gamesPlayed) * 100) : 0;

  return {
    gamesPlayed,
    completedCount,
    winRate,
    inProgressSessions,
    abandonedSessions,
  };
}

/**
 * Fetch historical session summaries and aggregated quick statistics for all game sessions.
 *
 * @returns An object with `sessions` — an array of session summaries (HistorySessionItem) sorted by `lastActivityAt` descending then `sessionId` descending; and `quickStats` — aggregate metrics (`gamesPlayed`, `wins`, `winRate`, `inProgressSessions`, `abandonedSessions`).
 */
export async function getHistoryData(): Promise<HistoryData> {
  const [sessions, latestTurns] = await Promise.all([
    db.query.gameSessions.findMany({
      with: {
        gamePlayers: {
          with: { player: true },
          orderBy: [asc(gamePlayers.playerOrder)],
        },
      },
    }),
    db
      .select({
        gameSessionId: gameTurns.gameSessionId,
        latestTurnAt: max(gameTurns.createdAt),
      })
      .from(gameTurns)
      .groupBy(gameTurns.gameSessionId),
  ]);

  const latestTurnBySessionId = new Map<number, Date>();
  for (const turn of latestTurns) {
    const latestTurnAt = normalizeLatestTurnAt(turn.latestTurnAt);
    if (!latestTurnAt) continue;
    latestTurnBySessionId.set(turn.gameSessionId, latestTurnAt);
  }

  const mappedSessions: HistorySessionItem[] = sessions
    .map((session) => {
      const winner = session.gamePlayers.find((player) => player.isWinner === true);
      const latestTurnAt = latestTurnBySessionId.get(session.id) ?? null;
      const lastActivityAt = getLastActivityAt(
        session.startedAt ?? null,
        session.completedAt ?? null,
        latestTurnAt,
        session.createdAt,
      );

      return {
        sessionId: session.id,
        gameSlug: session.gameSlug,
        gameName: GAME_NAMES.get(session.gameSlug) ?? session.gameSlug,
        status: normalizeSessionStatus(session.status),
        startedAt: session.startedAt ?? null,
        completedAt: session.completedAt ?? null,
        lastActivityAt,
        playerCount: session.gamePlayers.length,
        playerNames: session.gamePlayers.map((player) => player.player.name),
        playerIds: session.gamePlayers.map((player) => player.playerId),
        currentRound: session.currentRound,
        winnerName: winner?.player.name ?? null,
        winnerPlayerId: winner?.playerId ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.lastActivityAt.getTime() - a.lastActivityAt.getTime() ||
        b.sessionId - a.sessionId,
    );

  return {
    sessions: mappedSessions,
    quickStats: buildQuickStats(mappedSessions),
  };
}
