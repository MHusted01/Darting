import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { getMutualClubs, getPlayerRecentGames } from '@/lib/friend-social';
import { computeCurrentStreak } from '@/lib/social-stats';
import { useSupabase } from '@/providers/SupabaseProvider';

export function usePlayerRecentGames(userId: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ['player-recent-games', userId],
    queryFn: () => getPlayerRecentGames(supabase, userId),
    enabled: Boolean(supabase && userId),
    staleTime: 60_000,
  });
}

export function useMutualClubs(userId: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ['mutual-clubs', userId],
    queryFn: () => getMutualClubs(supabase, userId),
    enabled: Boolean(supabase && userId),
    staleTime: 60_000,
  });
}

export function usePlayerStreak(userId: string) {
  const supabase = useSupabase();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['player-streak-games', userId],
    queryFn: () => getPlayerRecentGames(supabase, userId, 90),
    enabled: Boolean(supabase && userId),
    staleTime: 60_000,
  });

  const gamesArray = Array.isArray(data) ? data : [];
  const streak = gamesArray.length > 0
    ? computeCurrentStreak(gamesArray.map((g) => ({ completedAt: g.completedAt })))
    : 0;
  return { streak, isLoading, isError };
}

export function useCurrentUserId() {
  const { userId } = useAuth();
  return userId;
}
