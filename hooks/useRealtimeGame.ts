import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useChallengeChannel } from '@/hooks/useChallengeChannel';
import { abandonChallenge, submitTurnToServer } from '@/lib/realtime-api';
import { buildTurnPayload, type TurnBroadcastPayload } from '@/lib/realtime-game';
import type { LoadedGameState } from '@/hooks/usePlaySession';
import type { DartThrow } from '@/types/game';

interface UseRealtimeGameParams {
  challengeId: string | null;
  gameState: LoadedGameState | null;
  applyRemoteTurn: (
    darts: DartThrow[],
    remoteUserId: string,
    localUserId: string,
  ) => Promise<void>;
}

export function useRealtimeGame({
  challengeId,
  gameState,
  applyRemoteTurn,
}: UseRealtimeGameParams) {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);

  const handleTurn = useCallback(
    (payload: TurnBroadcastPayload) => {
      if (!userId || payload.userId === userId) return;
      void applyRemoteTurn(payload.darts, payload.userId, userId);
    },
    [applyRemoteTurn, userId],
  );

  const handleChallengeUpdate = useCallback(
    (update: { status: string }) => {
      setChallengeStatus(update.status);
    },
    [],
  );

  const { onlineUserIds } = useChallengeChannel({
    challengeId,
    mode: 'participant',
    onTurn: handleTurn,
    onChallengeUpdate: handleChallengeUpdate,
  });

  const isMyTurn = useMemo(() => {
    if (!gameState || !userId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.userId === userId;
  }, [gameState, userId]);

  const opponentUserId = useMemo(() => {
    if (!gameState || !userId) return null;
    return gameState.players.find((player) => player.userId && player.userId !== userId)?.userId ?? null;
  }, [gameState, userId]);

  const opponentOnline = opponentUserId !== null && onlineUserIds.has(opponentUserId);

  const onBeforeCommitTurn = useCallback(
    async (
      darts: DartThrow[],
      isComplete: boolean,
      winnerGamePlayerId: number | null | undefined,
      currentGameState: LoadedGameState,
      newScore: number,
    ) => {
      if (!challengeId || !userId) return;

      const currentPlayer = currentGameState.players[currentGameState.currentPlayerIndex];
      const winnerUserId = isComplete
        ? winnerGamePlayerId === null
          ? null
          : (currentGameState.players.find(
              (player) => player.id === (winnerGamePlayerId ?? currentPlayer.id),
            )?.userId ?? null)
        : null;

      const scores: Record<string, number> = {};
      for (const player of currentGameState.players) {
        if (!player.userId) continue;
        scores[player.userId] = player.id === currentPlayer.id ? newScore : player.currentScore;
      }

      const completedTurns =
        (currentGameState.currentRound - 1) * currentGameState.players.length +
        currentGameState.currentPlayerIndex;
      const turnSeq = completedTurns + 1;
      const payload = buildTurnPayload({
        challengeId,
        turnSeq,
        userId,
        darts,
        isComplete,
        winnerUserId,
        scores,
      });

      await submitTurnToServer(supabase, payload);
    },
    [challengeId, supabase, userId],
  );

  const abandon = useCallback(async () => {
    if (!challengeId) return;
    await abandonChallenge(supabase, challengeId);
  }, [challengeId, supabase]);

  return {
    isMyTurn,
    opponentUserId,
    opponentOnline,
    challengeStatus,
    onBeforeCommitTurn,
    abandon,
  };
}
