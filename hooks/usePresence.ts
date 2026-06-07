import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import type { FriendStatus, PresenceMap } from '@/types/social';

type PresencePayload = { user_id: string; status: FriendStatus };

export function usePresence() {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: userId } },
    });

    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>();
      const map: PresenceMap = {};
      for (const [key, presences] of Object.entries(state)) {
        const first = (presences as PresencePayload[])[0];
        if (first) map[key] = first.status;
      }
      setPresenceMap(map);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, status: 'online' } satisfies PresencePayload);
      }
    });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const setStatus = useCallback(async (status: FriendStatus) => {
    if (!channelRef.current || !userId) return;
    await channelRef.current.track({ user_id: userId, status } satisfies PresencePayload);
  }, [userId]);

  return { presenceMap, setStatus };
}
