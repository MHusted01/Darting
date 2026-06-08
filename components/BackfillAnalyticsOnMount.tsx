import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import { backfillAnalytics } from '@/lib/analytics-backfill';
import { retryFailedSyncs } from '@/lib/sync-manager';

export function BackfillAnalyticsOnMount() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const firedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || firedForUser.current === userId) return;
    firedForUser.current = userId;

    backfillAnalytics()
      .then(({ sessionsMarkedUnsynced }) => {
        if (sessionsMarkedUnsynced > 0) {
          return retryFailedSyncs(userId, getToken);
        }
      })
      .catch(console.error);
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}
