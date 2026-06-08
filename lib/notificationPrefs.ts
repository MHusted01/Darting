import type { SupabaseClient } from '@supabase/supabase-js';

export interface NotificationPrefs {
  friend_requests: boolean;
  club_invites: boolean;
  tournament_updates: boolean;
  match_challenges: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  friend_requests: true,
  club_invites: true,
  tournament_updates: true,
  match_challenges: true,
};

export async function getNotificationPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return (data?.notification_prefs as NotificationPrefs | null) ?? DEFAULT_PREFS;
}

export async function updateNotificationPrefs(
  supabase: SupabaseClient,
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ notification_prefs: prefs })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}
