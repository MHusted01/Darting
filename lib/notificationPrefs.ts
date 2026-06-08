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
  const raw = data?.notification_prefs as Partial<NotificationPrefs> | null;
  if (!raw) return DEFAULT_PREFS;
  return {
    friend_requests:    typeof raw.friend_requests    === 'boolean' ? raw.friend_requests    : DEFAULT_PREFS.friend_requests,
    club_invites:       typeof raw.club_invites       === 'boolean' ? raw.club_invites       : DEFAULT_PREFS.club_invites,
    tournament_updates: typeof raw.tournament_updates === 'boolean' ? raw.tournament_updates : DEFAULT_PREFS.tournament_updates,
    match_challenges:   typeof raw.match_challenges   === 'boolean' ? raw.match_challenges   : DEFAULT_PREFS.match_challenges,
  };
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
