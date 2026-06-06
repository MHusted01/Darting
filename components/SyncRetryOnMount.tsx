import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import { retryFailedSyncs } from '@/lib/sync-manager';

export function SyncRetryOnMount() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const firedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || firedForUser.current === userId) return;
    firedForUser.current = userId;
    retryFailedSyncs(userId, getToken).catch(console.error);
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}
