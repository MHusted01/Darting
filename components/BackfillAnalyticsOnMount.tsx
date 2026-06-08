import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import * as Sentry from '@sentry/react-native';
import { backfillAnalytics } from '@/lib/analytics-backfill';
import { retryFailedSyncs } from '@/lib/sync-manager';

export function BackfillAnalyticsOnMount() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const firedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || firedForUser.current === userId) return;

    backfillAnalytics()
      .then(async ({ sessionsMarkedUnsynced }) => {
        if (sessionsMarkedUnsynced > 0) {
          await retryFailedSyncs(userId, getToken);
        }
        firedForUser.current = userId;
      })
      .catch(Sentry.captureException);
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}
