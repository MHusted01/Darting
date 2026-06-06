import { eq, asc } from 'drizzle-orm';
import * as ExpoCrypto from 'expo-crypto';
import { db } from '@/db/client';
import { gameSessions, gamePlayers, gameTurns, players } from '@/db/schema';
import { createClerkSupabaseClient } from '@/lib/supabase';
import type { DartThrow } from '@/types/game';

const randomUUID = () => ExpoCrypto.randomUUID();

export async function syncCompletedSession(
  sessionId: number,
  clerkUserId: string,
  getToken: (opts?: { template: string }) => Promise<string | null>,
): Promise<void> {
  const supabase = createClerkSupabaseClient(getToken);

  const session = await db.query.gameSessions.findFirst({
    where: eq(gameSessions.id, sessionId),
    with: {
      gamePlayers: {
        with: { player: true },
        orderBy: [asc(gamePlayers.playerOrder)],
      },
      gameTurns: true,
    },
  });

  if (!session || session.status !== 'completed') return;

  const cloudSessionId = randomUUID();

  const { error: sessionErr } = await supabase
    .from('game_sessions')
    .insert({
      id: cloudSessionId,
      game_slug: session.gameSlug,
      status: 'completed',
      created_by: clerkUserId,
      config: session.config ?? null,
      started_at: session.startedAt?.toISOString() ?? new Date().toISOString(),
      completed_at: session.completedAt?.toISOString() ?? null,
    });

  if (sessionErr) throw new Error(`sync: session insert failed: ${sessionErr.message}`);

  const playerRows = session.gamePlayers.map((gp) => ({
    id: randomUUID(),
    game_session_id: cloudSessionId,
    user_id: gp.player.userId ?? null,
    player_name: gp.player.name,
    player_order: gp.playerOrder,
    final_score: gp.currentScore,
    is_winner: gp.isWinner,
    game_state: gp.gameState ?? null,
    three_dart_avg: gp.threeDartAvg ?? null,
  }));

  const playerIdToName = new Map(
    session.gamePlayers.map((gp) => [gp.playerId, gp.player.name] as const),
  );

  const { error: playersErr } = await supabase.from('game_players').insert(playerRows);
  if (playersErr) throw new Error(`sync: players insert failed: ${playersErr.message}`);

  if (session.gameTurns.length > 0) {
    const turnRows = session.gameTurns.map((turn) => ({
      id: randomUUID(),
      game_session_id: cloudSessionId,
      user_id: session.gamePlayers.find((gp) => gp.playerId === turn.playerId)?.player.userId ?? null,
      player_name: playerIdToName.get(turn.playerId) ?? 'Unknown',
      round_number: turn.roundNumber,
      darts: turn.darts as DartThrow[],
      score_delta: turn.scoreDelta,
    }));

    const { error: turnsErr } = await supabase.from('game_turns').insert(turnRows);
    if (turnsErr) throw new Error(`sync: turns insert failed: ${turnsErr.message}`);
  }
}
