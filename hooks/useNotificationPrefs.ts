import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '@/lib/notificationPrefs';
import { useSupabase } from '@/providers/SupabaseProvider';

export function useNotificationPrefs() {
  const supabase = useSupabase();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['notification-prefs', userId],
    queryFn: () => getNotificationPrefs(supabase, userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPrefs() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefs: NotificationPrefs) => {
      if (!userId) return Promise.reject(new Error('Not authenticated'));
      return updateNotificationPrefs(supabase, userId, prefs);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-prefs', userId] });
    },
  });
}
