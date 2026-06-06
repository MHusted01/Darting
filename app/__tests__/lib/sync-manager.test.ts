import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/lib/supabase', () => ({
  createClerkSupabaseClient: jest.fn(),
}));

import { retryFailedSyncs } from '@/lib/sync-manager';

const getToken = async () => 'fake-token';

const makePendingSession = (id: number, cloudSyncStatus: 'failed' | 'unsynced' = 'failed') => ({
  id,
  gameSlug: 'x01',
  status: 'completed' as const,
  cloudSyncStatus,
  cloudSessionId: null,
});

function makeFakeDb(sessions: ReturnType<typeof makePendingSession>[]) {
  return {
    query: {
      gameSessions: {
        findMany: jest.fn<() => Promise<typeof sessions>>().mockResolvedValue(sessions),
      },
    },
  };
}

describe('retryFailedSyncs', () => {
  it('returns zeroed summary when clerkUserId is null', async () => {
    const syncOne = jest.fn();
    const result = await retryFailedSyncs(null, getToken, { syncOne: syncOne as never });
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
    expect(syncOne).not.toHaveBeenCalled();
  });

  it('returns zeroed summary when clerkUserId is undefined', async () => {
    const syncOne = jest.fn();
    const result = await retryFailedSyncs(undefined, getToken, { syncOne: syncOne as never });
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
    expect(syncOne).not.toHaveBeenCalled();
  });

  it('calls syncOne for each pending session (failed or unsynced)', async () => {
    const fakeDb = makeFakeDb([makePendingSession(1, 'failed'), makePendingSession(2, 'unsynced')]);
    const syncOne = jest.fn<() => Promise<{ cloudSessionId: string }>>().mockResolvedValue({ cloudSessionId: 'uuid' });

    const result = await retryFailedSyncs('user_abc', getToken, {
      db: fakeDb as never,
      syncOne: syncOne as never,
    });

    expect(syncOne).toHaveBeenCalledTimes(2);
    expect(syncOne).toHaveBeenCalledWith(1, 'user_abc', getToken);
    expect(syncOne).toHaveBeenCalledWith(2, 'user_abc', getToken);
    expect(result).toEqual({ attempted: 2, succeeded: 2, failed: 0 });
  });

  it('one failure does not abort others (Promise.allSettled semantics)', async () => {
    const fakeDb = makeFakeDb([makePendingSession(1), makePendingSession(2), makePendingSession(3)]);
    const syncOne = jest.fn<(id: number) => Promise<{ cloudSessionId: string }>>()
      .mockImplementation((id) => {
        if (id === 2) return Promise.reject(new Error('network error'));
        return Promise.resolve({ cloudSessionId: 'uuid' });
      });

    const result = await retryFailedSyncs('user_abc', getToken, {
      db: fakeDb as never,
      syncOne: syncOne as never,
    });

    expect(result).toEqual({ attempted: 3, succeeded: 2, failed: 1 });
  });

  it('returns zeroed summary when there are no pending sessions', async () => {
    const fakeDb = makeFakeDb([]);
    const syncOne = jest.fn();

    const result = await retryFailedSyncs('user_abc', getToken, {
      db: fakeDb as never,
      syncOne: syncOne as never,
    });

    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
    expect(syncOne).not.toHaveBeenCalled();
  });
});
