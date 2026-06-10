import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/providers/SupabaseProvider';
import {
  createTournament,
  getClubTournaments,
  getMyActiveTournaments,
  getTournamentDetail,
  registerParticipant,
  unregisterParticipant,
  updateTournamentStatus,
  startTournament,
  completeTournamentMatch,
  createDivision,
  inviteClubToDivision,
  acceptDivisionInvite,
  type CreateTournamentInput,
} from '@/lib/tournament-api';
import type { TournamentFormat, TournamentParticipant, TournamentStatus } from '@/types/tournament';

const PAGE_SIZE = 20;

export function useClubTournaments(clubId: string) {
  const supabase = useSupabase();
  return useInfiniteQuery({
    queryKey: ['club-tournaments', clubId],
    queryFn: ({ pageParam }) =>
      getClubTournaments(supabase!, clubId, pageParam as string | null, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(supabase && clubId),
    staleTime: 30_000,
  });
}

export function useMyActiveTournaments() {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ['my-active-tournaments'],
    queryFn: () => getMyActiveTournaments(supabase!),
    enabled: Boolean(supabase),
    staleTime: 30_000,
  });
}

export function useTournamentDetail(tournamentId: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournamentDetail(supabase!, tournamentId),
    enabled: Boolean(supabase && tournamentId),
    staleTime: 15_000,
  });
}

export function useCreateTournament(clubId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTournamentInput) => createTournament(supabase!, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
      void queryClient.invalidateQueries({ queryKey: ['my-active-tournaments'] });
    },
  });
}

export function useRegisterParticipant(tournamentId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, clubId }: { userId: string; clubId?: string }) =>
      registerParticipant(supabase!, tournamentId, userId, clubId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
    },
  });
}

export function useUnregisterParticipant(tournamentId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => unregisterParticipant(supabase!, tournamentId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
    },
  });
}

export function useStartTournament(tournamentId: string, clubId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ format, participants }: { format: TournamentFormat; participants: TournamentParticipant[] }) =>
      startTournament(supabase!, tournamentId, format, participants),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });
}

export function useUpdateTournamentStatus(tournamentId: string, clubId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: TournamentStatus) => updateTournamentStatus(supabase!, tournamentId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });
}

export function useCompleteTournamentMatch(tournamentId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId,
      winnerId,
      sessionId,
    }: {
      matchId: string;
      winnerId: string;
      sessionId: string;
    }) => completeTournamentMatch(supabase!, matchId, winnerId, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
    },
  });
}

export function useCreateDivision() {
  const supabase = useSupabase();
  return useMutation({
    mutationFn: ({ name, adminUserId }: { name: string; adminUserId: string }) =>
      createDivision(supabase!, name, adminUserId),
  });
}

export function useInviteClubToDivision(divisionId: string) {
  const supabase = useSupabase();
  return useMutation({
    mutationFn: (clubId: string) => inviteClubToDivision(supabase!, divisionId, clubId),
  });
}

export function useAcceptDivisionInvite(divisionId: string, clubId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => acceptDivisionInvite(supabase!, divisionId, clubId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
    },
  });
}
