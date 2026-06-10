import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { useSupabase } from '@/providers/SupabaseProvider';
import { parseTurnPayload, type TurnBroadcastPayload } from '@/lib/realtime-game';
import { getChallenge } from '@/lib/realtime-api';

type PresencePayload = { user_id: string };

interface ChallengeRowUpdate {
  status: string;
  current_turn_user_id: string | null;
  turn_count: number;
  last_turn: unknown;
  winner_user_id: string | null;
}

interface UseChallengeChannelParams {
  challengeId: string | null;
  mode: 'participant' | 'spectator';
  onTurn?: (payload: TurnBroadcastPayload) => void;
  onChallengeUpdate?: (update: ChallengeRowUpdate) => void;
}

export function useChallengeChannel({
  challengeId,
  mode,
  onTurn,
  onChallengeUpdate,
}: UseChallengeChannelParams) {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<ReadonlySet<string>>(new Set());

  const onTurnRef = useRef(onTurn);
  const onChallengeUpdateRef = useRef(onChallengeUpdate);
  onTurnRef.current = onTurn;
  onChallengeUpdateRef.current = onChallengeUpdate;
  const lastTurnSeqRef = useRef(0);

  useEffect(() => {
    if (!challengeId || !userId) return;

    const channel = supabase.channel(`challenge:${challengeId}`, {
      config: { presence: { key: userId }, private: true },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>();
      setOnlineUserIds(new Set(Object.keys(state)));
    });

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_challenges',
        filter: `id=eq.${challengeId}`,
      },
      (message) => {
        emitRow(message.new as unknown as ChallengeRowUpdate);
      },
    );

    function emitRow(row: ChallengeRowUpdate) {
      const payload = parseTurnPayload(row.last_turn);
      if (
        payload &&
        payload.challengeId === challengeId &&
        payload.turnSeq > lastTurnSeqRef.current
      ) {
        lastTurnSeqRef.current = payload.turnSeq;
        onTurnRef.current?.(payload);
      }
      onChallengeUpdateRef.current?.(row);
    }

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      if (mode === 'participant') {
        await channel.track({ user_id: userId } satisfies PresencePayload);
      }
      try {
        const challenge = await getChallenge(supabase, challengeId);
        emitRow({
          status: challenge.status,
          current_turn_user_id: challenge.currentTurnUserId,
          turn_count: challenge.turnCount,
          last_turn: challenge.lastTurn,
          winner_user_id: challenge.winnerUserId,
        });
      } catch (error) {
        console.error('Failed to recover challenge state:', error);
      }
    });

    return () => {
      if (mode === 'participant') void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [supabase, challengeId, userId, mode]);

  return { onlineUserIds };
}
