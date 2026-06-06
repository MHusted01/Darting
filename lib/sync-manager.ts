import { and, eq, ne } from 'drizzle-orm';
import { db as defaultDb } from '@/db/client';
import { gameSessions } from '@/db/schema';
import { syncCompletedSession } from '@/lib/supabase-sync';

type GetToken = (opts?: { template: string }) => Promise<string | null>;

export type RetrySummary = { attempted: number; succeeded: number; failed: number };

type RetryDeps = {
  db?: typeof defaultDb;
  syncOne?: typeof syncCompletedSession;
};

export async function retryFailedSyncs(
  clerkUserId: string | null | undefined,
  getToken: GetToken,
  deps: RetryDeps = {},
): Promise<RetrySummary> {
  if (!clerkUserId) return { attempted: 0, succeeded: 0, failed: 0 };

  const db = deps.db ?? defaultDb;
  const syncOne = deps.syncOne ?? syncCompletedSession;

  const failedSessions = await db.query.gameSessions.findMany({
    where: and(
      eq(gameSessions.status, 'completed'),
      ne(gameSessions.cloudSyncStatus, 'synced'),
    ),
  });

  if (failedSessions.length === 0) return { attempted: 0, succeeded: 0, failed: 0 };

  const results = await Promise.allSettled(
    failedSessions.map((s) => syncOne(s.id, clerkUserId, getToken)),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  return {
    attempted: results.length,
    succeeded,
    failed: results.length - succeeded,
  };
}
