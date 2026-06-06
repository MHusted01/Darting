import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import { retryFailedSyncs } from '@/lib/sync-manager';

export function SyncRetryOnMount() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const fired = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || fired.current) return;
    fired.current = true;
    retryFailedSyncs(userId, getToken).catch(console.error);
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}
