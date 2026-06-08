import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { gamePlayers, gameSessions, gameTurns } from '@/db/schema';
import type { DartThrow } from '@/types/game';
import { computeSessionAnalytics } from '@/lib/games/analytics';

export async function backfillAnalytics(): Promise<{ sessionsMarkedUnsynced: number }> {
  const rows = await db
    .select({
      gamePlayerId: gamePlayers.id,
      playerId: gamePlayers.playerId,
      sessionId: gameSessions.id,
      gameSlug: gameSessions.gameSlug,
      config: gameSessions.config,
    })
    .from(gamePlayers)
    .innerJoin(gameSessions, eq(gameSessions.id, gamePlayers.gameSessionId))
    .where(
      and(
        eq(gameSessions.status, 'completed'),
        isNull(gamePlayers.analytics),
      ),
    );

  const touchedSessionIds = new Set<number>();

  for (const row of rows) {
    const turns = await db
      .select({
        roundNumber: gameTurns.roundNumber,
        darts: gameTurns.darts,
        scoreDelta: gameTurns.scoreDelta,
      })
      .from(gameTurns)
      .where(
        and(
          eq(gameTurns.gameSessionId, row.sessionId),
          eq(gameTurns.playerId, row.playerId),
        ),
      )
      .orderBy(asc(gameTurns.roundNumber), asc(gameTurns.id));

    const typedTurns = turns.map((t) => ({
      roundNumber: t.roundNumber,
      darts: t.darts as DartThrow[],
      scoreDelta: t.scoreDelta,
    }));

    const analytics = computeSessionAnalytics(row.gameSlug, typedTurns, row.config);

    // Write analytics and mark session unsynced atomically so an interrupted
    // backfill never leaves analytics written without the re-sync marker.
    await db.transaction(async (tx) => {
      await tx
        .update(gamePlayers)
        .set({ analytics })
        .where(eq(gamePlayers.id, row.gamePlayerId));

      await tx
        .update(gameSessions)
        .set({ cloudSyncStatus: 'unsynced' })
        .where(eq(gameSessions.id, row.sessionId));
    });

    touchedSessionIds.add(row.sessionId);
  }

  return { sessionsMarkedUnsynced: touchedSessionIds.size };
}
