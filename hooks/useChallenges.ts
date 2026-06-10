import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptChallenge,
  cancelChallenge,
  createChallenge,
  declineChallenge,
  listIncomingChallenges,
  listOutgoingChallenges,
} from '@/lib/realtime-api';
import type { ChallengeSettings } from '@/lib/realtime-game';
import { useSupabase } from '@/providers/SupabaseProvider';

export function useIncomingChallenges() {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['challenges', 'incoming', userId],
    queryFn: () => listIncomingChallenges(supabase, userId!),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
}

export function useOutgoingChallenges() {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['challenges', 'outgoing', userId],
    queryFn: () => listOutgoingChallenges(supabase, userId!),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
}

function useChallengeMutation(
  mutationFn: (challengeId: string) => Promise<boolean>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}

export function useAcceptChallenge() {
  const supabase = useSupabase();
  return useChallengeMutation((challengeId) => acceptChallenge(supabase, challengeId));
}

export function useDeclineChallenge() {
  const supabase = useSupabase();
  return useChallengeMutation((challengeId) => declineChallenge(supabase, challengeId));
}

export function useCancelChallenge() {
  const supabase = useSupabase();
  return useChallengeMutation((challengeId) => cancelChallenge(supabase, challengeId));
}

export interface CreateChallengeVariables {
  challengeeId: string;
  gameSlug: string;
  settings: ChallengeSettings;
}

export function useCreateChallenge() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: CreateChallengeVariables) =>
      createChallenge(supabase, {
        challengerId: userId!,
        challengeeId: variables.challengeeId,
        gameSlug: variables.gameSlug,
        settings: variables.settings,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}
