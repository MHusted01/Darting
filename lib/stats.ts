import { and, eq, max, avg, count, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { gameSessions, gamePlayers, gameTurns } from '@/db/schema';
import { GAMES } from '@/constants/games';

const GAME_NAMES = new Map(GAMES.map((g) => [g.slug, g.name] as const));

export interface PersonalBestRow {
  gameSlug: string;
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number | null;
  avgThreeDartAvg: number | null;
}

export interface PersonalBest extends PersonalBestRow {
  gameName: string;
}

export interface StatsFilter {
  slug?: string;
  since?: Date;
}

export function computeThreeDartAvg(
  turns: Array<{ darts: number; scoreDelta: number }>,
): number {
  const totalDarts = turns.reduce((sum, t) => sum + t.darts, 0);
  if (totalDarts === 0) return 0;
  const totalScore = turns.reduce((sum, t) => sum + t.scoreDelta, 0);
  return (totalScore / totalDarts) * 3;
}

export function buildPersonalBestsFromRows(rows: PersonalBestRow[]): PersonalBest[] {
  return rows.map((row) => ({
    ...row,
    gameName: GAME_NAMES.get(row.gameSlug) ?? row.gameSlug,
  }));
}

export async function getPersonalBests(playerId: number): Promise<PersonalBest[]> {
  const rows = await db
    .select({
      gameSlug: gameSessions.gameSlug,
      gamesPlayed: sql<number>`count(DISTINCT ${gameSessions.id})`,
      gamesWon: sql<number>`sum(${gamePlayers.isWinner})`,
      bestScore: max(gamePlayers.currentScore),
      avgThreeDartAvg: avg(gamePlayers.threeDartAvg),
    })
    .from(gameSessions)
    .innerJoin(gamePlayers, eq(gamePlayers.gameSessionId, gameSessions.id))
    .where(and(eq(gameSessions.status, 'completed'), eq(gamePlayers.playerId, playerId)))
    .groupBy(gameSessions.gameSlug);

  const mapped: PersonalBestRow[] = rows.map((r) => ({
    gameSlug: r.gameSlug,
    gamesPlayed: r.gamesPlayed,
    gamesWon: Number(r.gamesWon ?? 0),
    bestScore: r.bestScore ?? null,
    avgThreeDartAvg: r.avgThreeDartAvg != null ? Number(r.avgThreeDartAvg) : null,
  }));

  return buildPersonalBestsFromRows(mapped);
}

export async function getOverallThreeDartAvg(playerId: number): Promise<number | null> {
  const [result] = await db
    .select({ value: avg(gamePlayers.threeDartAvg) })
    .from(gamePlayers)
    .innerJoin(gameSessions, eq(gameSessions.id, gamePlayers.gameSessionId))
    .where(and(eq(gameSessions.status, 'completed'), eq(gamePlayers.playerId, playerId)));

  if (result?.value == null) return null;
  const n = Number(result.value);
  return Number.isFinite(n) ? n : null;
}

export async function getSessionThreeDartAvg(
  sessionId: number,
  playerId: number,
): Promise<number | null> {
  const turns = await db
    .select({ darts: gameTurns.darts, scoreDelta: gameTurns.scoreDelta })
    .from(gameTurns)
    .where(and(eq(gameTurns.gameSessionId, sessionId), eq(gameTurns.playerId, playerId)));

  const playerTurns = turns.map((t) => {
    const d = t.darts as Array<{ segment: number; multiplier: number }>;
    return { darts: d.length, scoreDelta: t.scoreDelta };
  });

  if (playerTurns.length === 0) return null;
  const avg = computeThreeDartAvg(playerTurns);
  return Number.isFinite(avg) ? avg : null;
}
