import { asc, sql } from 'drizzle-orm';
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
  wins: number;
  winRate: number;
  inProgressSessions: number;
  abandonedSessions: number;
}

export interface HistoryData {
  sessions: HistorySessionItem[];
  quickStats: HistoryQuickStats;
}

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

function normalizeLatestTurnAt(value: Date | string | number | null): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value * 1000);
  }

  const trimmedValue = value.trim();
  const numericValue = Number(trimmedValue);
  if (!Number.isNaN(numericValue) && trimmedValue.length > 0) {
    return new Date(numericValue * 1000);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

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
  const wins = completedSessions.length;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  return {
    gamesPlayed,
    wins,
    winRate,
    inProgressSessions,
    abandonedSessions,
  };
}

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
        latestTurnAt: sql<Date | string | number | null>`max(${gameTurns.createdAt})`,
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
