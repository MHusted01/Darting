import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createClub,
  getClubLeaderboard,
  getClubMembers,
  getMyClubs,
  inviteMember,
  joinClub,
  leaveClub,
  searchClubs,
} from '@/lib/clubs';
import { useSupabase } from '@/providers/SupabaseProvider';

export function useMyClubs() {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['my-clubs', userId],
    queryFn: () => getMyClubs(supabase, userId!),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useClubSearch(query: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ['club-search', query],
    queryFn: () => searchClubs(supabase, query),
    enabled: query.length >= 2,
    staleTime: 10_000,
  });
}

export function useClubMembers(clubId: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ['club-members', clubId],
    queryFn: () => getClubMembers(supabase, clubId),
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });
}

export function useClubLeaderboard(clubId: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ['club-leaderboard', clubId],
    queryFn: () => getClubLeaderboard(supabase, clubId),
    enabled: Boolean(clubId),
    staleTime: 60_000,
  });
}

export function useCreateClub() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createClub(supabase, userId!, name, description),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
    },
  });
}

export function useJoinClub() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => joinClub(supabase, clubId, userId!),
    onSuccess: (_data, clubId) => {
      void queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      void queryClient.invalidateQueries({ queryKey: ['club-members', clubId] });
    },
  });
}

export function useLeaveClub() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => leaveClub(supabase, clubId, userId!),
    onSuccess: (_data, clubId) => {
      void queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      void queryClient.invalidateQueries({ queryKey: ['club-members', clubId] });
    },
  });
}

export function useInviteMember(clubId: string) {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteeId: string) => inviteMember(supabase, clubId, userId!, inviteeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-members', clubId] });
    },
  });
}
