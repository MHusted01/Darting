import { eq, asc } from 'drizzle-orm';
import { db as defaultDb } from '@/db/client';
import { gameSessions, gamePlayers, gameTurns } from '@/db/schema';
import { createClerkSupabaseClient } from '@/lib/supabase';
import type { DartThrow } from '@/types/game';

type GetToken = (opts?: { template: string }) => Promise<string | null>;

type SyncableSession = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

type SyncDeps = {
  db: typeof defaultDb;
  createSupabaseClient: typeof createClerkSupabaseClient;
};

export type SyncResult = { cloudSessionId: string };

const defaultDeps: SyncDeps = {
  db: defaultDb,
  createSupabaseClient: createClerkSupabaseClient,
};

async function loadSession(db: typeof defaultDb, sessionId: number) {
  return db.query.gameSessions.findFirst({
    where: eq(gameSessions.id, sessionId),
    with: {
      gamePlayers: {
        with: { player: true },
        orderBy: [asc(gamePlayers.playerOrder)],
      },
      gameTurns: true,
    },
  });
}

export function buildSessionPayload(
  session: SyncableSession,
  clerkUserId: string,
): Record<string, unknown> {
  return {
    game_slug: session.gameSlug,
    status: 'completed',
    created_by: clerkUserId,
    source_session_id: String(session.id),
    config: session.config ?? null,
    started_at: session.startedAt?.toISOString() ?? session.createdAt.toISOString(),
    completed_at: session.completedAt?.toISOString() ?? null,
  };
}

export function buildPlayerPayloads(
  session: SyncableSession,
  cloudSessionId: string,
): Record<string, unknown>[] {
  return session.gamePlayers.map((gp) => ({
    game_session_id: cloudSessionId,
    user_id: gp.player.userId ?? null,
    player_name: gp.player.name,
    player_order: gp.playerOrder,
    final_score: gp.currentScore,
    is_winner: gp.isWinner,
    game_state: gp.gameState ?? null,
    three_dart_avg: gp.threeDartAvg ?? null,
  }));
}

export function buildTurnPayloads(
  session: SyncableSession,
  cloudSessionId: string,
): Record<string, unknown>[] {
  const playerMap = new Map(
    session.gamePlayers.map((gp) => [
      gp.playerId,
      { userId: gp.player.userId ?? null, name: gp.player.name },
    ]),
  );

  return session.gameTurns.map((turn) => {
    const playerInfo = playerMap.get(turn.playerId);
    return {
      game_session_id: cloudSessionId,
      user_id: playerInfo?.userId ?? null,
      player_name: playerInfo?.name ?? 'Unknown',
      round_number: turn.roundNumber,
      darts: turn.darts as DartThrow[],
      score_delta: turn.scoreDelta,
    };
  });
}

export async function syncCompletedSession(
  sessionId: number,
  clerkUserId: string,
  getToken: GetToken,
  deps: SyncDeps = defaultDeps,
): Promise<SyncResult> {
  const { db, createSupabaseClient } = deps;
  const supabase = createSupabaseClient(getToken);

  const session = await loadSession(db, sessionId);
  if (!session || session.status !== 'completed') {
    return { cloudSessionId: '' };
  }

  const markStatus = (cloudSyncStatus: 'synced' | 'failed', cloudSessionId?: string) =>
    db
      .update(gameSessions)
      .set(cloudSessionId ? { cloudSyncStatus, cloudSessionId } : { cloudSyncStatus })
      .where(eq(gameSessions.id, sessionId));

  try {
    const { data: sessionData, error: sessionErr } = await supabase
      .from('game_sessions')
      .upsert([buildSessionPayload(session, clerkUserId)], {
        onConflict: 'created_by,source_session_id',
      })
      .select('id')
      .single();

    if (sessionErr) throw new Error(sessionErr.message);

    const cloudSessionId = (sessionData as { id: string }).id;

    const { error: playersErr } = await supabase
      .from('game_players')
      .upsert(buildPlayerPayloads(session, cloudSessionId), {
        onConflict: 'game_session_id,player_order',
      });

    if (playersErr) throw new Error(playersErr.message);

    const turnRows = buildTurnPayloads(session, cloudSessionId);
    if (turnRows.length > 0) {
      // Non-atomic: Supabase REST has no multi-table transactions. Delete then insert is
      // idempotent across retries — a failed insert marks the session as 'failed' and the
      // next retry re-deletes (no-op) and re-inserts. Local SQLite is always the source of truth.
      const { error: deleteErr } = await supabase
        .from('game_turns')
        .delete()
        .eq('game_session_id', cloudSessionId);
      if (deleteErr) throw new Error(deleteErr.message);

      const { error: insertErr } = await supabase.from('game_turns').insert(turnRows);
      if (insertErr) throw new Error(insertErr.message);
    }

    await markStatus('synced', cloudSessionId);
    return { cloudSessionId };
  } catch (err) {
    await markStatus('failed');
    throw err;
  }
}
