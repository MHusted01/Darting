import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/expo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSupabase } from '@/providers/SupabaseProvider';

export async function registerPushToken(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token) return;

  const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
  if (error) {
    Sentry.captureException(error, { tags: { context: 'push_token_upsert' } });
  }
}

export function usePushToken(): void {
  const supabase = useSupabase();
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded || !userId) return;
    const projectId = (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? '';
    registerPushToken(supabase, userId, projectId).catch(() => {});
  }, [supabase, userId, isLoaded]);
}
