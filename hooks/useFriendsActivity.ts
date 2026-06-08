import { useAuth } from '@clerk/expo';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getFriendsActivityPage } from '@/lib/friend-social';
import { useSupabase } from '@/providers/SupabaseProvider';
import type { ActivityPage } from '@/types/social';

const PAGE_SIZE = 20;

export function useFriendsActivity() {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useInfiniteQuery({
    queryKey: ['friends-activity', userId],
    queryFn: ({ pageParam }) => getFriendsActivityPage(supabase, pageParam as string | null, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: ActivityPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(supabase && userId),
    staleTime: 30_000,
  });
}
