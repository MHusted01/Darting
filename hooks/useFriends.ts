import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from '@/lib/friends';
import { useSupabase } from '@/providers/SupabaseProvider';

export function useFriends() {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['friends', userId],
    queryFn: () => getFriends(supabase, userId!),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function usePendingRequests() {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['friend-requests', userId],
    queryFn: () => getPendingRequests(supabase, userId!),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useUserSearch(query: string) {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['user-search', userId, query],
    queryFn: () => searchUsers(supabase, query, userId!),
    enabled: query.length >= 2 && Boolean(userId),
    staleTime: 10_000,
  });
}

export function useSendFriendRequest() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (addresseeId: string) => sendFriendRequest(supabase, userId!, addresseeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });
}

export function useAcceptFriendRequest() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) => acceptFriendRequest(supabase, friendshipId, userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });
}

export function useDeclineFriendRequest() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) => declineFriendRequest(supabase, friendshipId, userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });
}

export function useRemoveFriend() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) => removeFriend(supabase, friendshipId, userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
