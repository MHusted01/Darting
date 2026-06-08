import type { MutualClub, RecentGame } from '@/types/social';

export function computeCurrentStreak(
  games: Array<{ completedAt: string }>,
  nowIso?: string,
): number {
  if (games.length === 0) return 0;

  const now = nowIso ? new Date(nowIso) : new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const days = new Set(
    games.map((g) => {
      const d = new Date(g.completedAt);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }),
  );

  const MS_PER_DAY = 86_400_000;
  const mostRecent = Math.max(...days);
  if (mostRecent < todayUtc - MS_PER_DAY) return 0;

  let streak = 0;
  let cursor = todayUtc;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= MS_PER_DAY;
  }
  if (streak === 0 && days.has(todayUtc - MS_PER_DAY)) {
    cursor = todayUtc - MS_PER_DAY;
    while (days.has(cursor)) {
      streak += 1;
      cursor -= MS_PER_DAY;
    }
  }
  return streak;
}

export type RawRecentGameRow = {
  id: string;
  game_slug: string;
  completed_at: string;
  is_winner: boolean;
  three_dart_avg: number | null;
};

export function mapRecentGameRow(row: RawRecentGameRow): RecentGame {
  return {
    id: row.id,
    gameSlug: row.game_slug,
    completedAt: row.completed_at,
    isWinner: row.is_winner,
    threeDartAvg: row.three_dart_avg,
  };
}

export function mapMutualClub(row: { id: string; name: string }): MutualClub {
  return { id: row.id, name: row.name };
}
