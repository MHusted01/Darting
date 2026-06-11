import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import {
  buildSessionPayload,
  buildPlayerPayloads,
  buildTurnPayloads,
  syncCompletedSession,
} from '@/lib/supabase-sync';

jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/lib/supabase', () => ({
  createClerkSupabaseClient: jest.fn(),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makePlayer = (overrides = {}) => ({
  id: 1,
  gameSessionId: 42,
  playerId: 10,
  playerOrder: 0,
  currentScore: 100,
  gameState: { remaining: 401 },
  isWinner: false,
  threeDartAvg: 45.0 as number | null,
  analytics: null as unknown,
  player: {
    id: 10,
    name: 'Alice',
    userId: 'user_abc' as string | null,
    avatarColor: '#aaa',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  ...overrides,
});

const makeSession = (overrides = {}) => ({
  id: 42,
  gameSlug: 'x01',
  status: 'completed' as const,
  context: 'casual' as const,
  config: { startingScore: 501 },
  startedAt: new Date('2026-06-01T10:00:00Z'),
  completedAt: new Date('2026-06-01T10:30:00Z'),
  currentRound: 5,
  currentPlayerIndex: 0,
  createdAt: new Date('2026-06-01T09:00:00Z'),
  cloudSyncStatus: 'unsynced' as const,
  cloudSessionId: null as string | null,
  tournamentMatchId: null as string | null,
  tournamentParticipant1Id: null as string | null,
  tournamentParticipant2Id: null as string | null,
  challengeId: null as string | null,
  challengeOpponentUserId: null as string | null,
  gamePlayers: [makePlayer()],
  gameTurns: [
    { id: 1, gameSessionId: 42, playerId: 10, roundNumber: 1, darts: [{ segment: 20, multiplier: 3 }], scoreDelta: 60, intendedTarget: null, createdAt: new Date('2026-06-01T10:05:00Z') },
  ],
  ...overrides,
});

const CLOUD_SESSION_ID = 'cloud-uuid-123';
const CLERK_USER_ID = 'user_clerk_abc';

// ─── buildSessionPayload ──────────────────────────────────────────────────────

describe('buildSessionPayload', () => {
  it('sets source_session_id to the string form of the local session id', () => {
    const payload = buildSessionPayload(makeSession(), CLERK_USER_ID);
    expect(payload.source_session_id).toBe('42');
  });

  it('sets created_by to the clerk user id', () => {
    const payload = buildSessionPayload(makeSession(), CLERK_USER_ID);
    expect(payload.created_by).toBe(CLERK_USER_ID);
  });

  it('sets game_slug and status', () => {
    const payload = buildSessionPayload(makeSession(), CLERK_USER_ID);
    expect(payload.game_slug).toBe('x01');
    expect(payload.status).toBe('completed');
  });

  it('converts timestamps to ISO strings', () => {
    const payload = buildSessionPayload(makeSession(), CLERK_USER_ID);
    expect(payload.started_at).toBe('2026-06-01T10:00:00.000Z');
    expect(payload.completed_at).toBe('2026-06-01T10:30:00.000Z');
  });

  it('passes config through as-is', () => {
    const payload = buildSessionPayload(makeSession(), CLERK_USER_ID);
    expect(payload.config).toEqual({ startingScore: 501 });
  });

  it('uses null for missing config', () => {
    const payload = buildSessionPayload(makeSession({ config: undefined }), CLERK_USER_ID);
    expect(payload.config).toBeNull();
  });

  it('uses null for missing completedAt', () => {
    const payload = buildSessionPayload(makeSession({ completedAt: null }), CLERK_USER_ID);
    expect(payload.completed_at).toBeNull();
  });

  it('falls back to createdAt (not new Date) when startedAt is null', () => {
    const createdAt = new Date('2026-06-01T09:00:00Z');
    const payload = buildSessionPayload(makeSession({ startedAt: null, createdAt }), CLERK_USER_ID);
    expect(payload.started_at).toBe(createdAt.toISOString());
  });

  it('does not include an id field (DB generates UUID)', () => {
    const payload = buildSessionPayload(makeSession(), CLERK_USER_ID);
    expect('id' in payload).toBe(false);
  });
});

// ─── buildPlayerPayloads ─────────────────────────────────────────────────────

describe('buildPlayerPayloads', () => {
  it('returns one row per player', () => {
    const session = makeSession({
      gamePlayers: [makePlayer({ playerOrder: 0 }), makePlayer({ id: 2, playerOrder: 1, player: { id: 11, name: 'Bob', userId: null as string | null, avatarColor: '#bbb', createdAt: new Date(), updatedAt: new Date() } })],
    });
    const rows = buildPlayerPayloads(session, CLOUD_SESSION_ID);
    expect(rows).toHaveLength(2);
  });

  it('sets game_session_id to the cloud session id', () => {
    const rows = buildPlayerPayloads(makeSession(), CLOUD_SESSION_ID);
    expect(rows[0].game_session_id).toBe(CLOUD_SESSION_ID);
  });

  it('maps player fields correctly', () => {
    const rows = buildPlayerPayloads(makeSession(), CLOUD_SESSION_ID);
    expect(rows[0].user_id).toBe('user_abc');
    expect(rows[0].player_name).toBe('Alice');
    expect(rows[0].player_order).toBe(0);
    expect(rows[0].final_score).toBe(100);
    expect(rows[0].is_winner).toBe(false);
    expect(rows[0].three_dart_avg).toBe(45.0);
  });

  it('uses null for missing user_id', () => {
    const session = makeSession({
      gamePlayers: [makePlayer({ player: { id: 10, name: 'Guest', userId: null as string | null, avatarColor: '#ccc', createdAt: new Date(), updatedAt: new Date() } })],
    });
    const rows = buildPlayerPayloads(session, CLOUD_SESSION_ID);
    expect(rows[0].user_id).toBeNull();
  });

  it('uses null for missing game_state', () => {
    const session = makeSession({ gamePlayers: [makePlayer({ gameState: null })] });
    const rows = buildPlayerPayloads(session, CLOUD_SESSION_ID);
    expect(rows[0].game_state).toBeNull();
  });

  it('uses null for missing three_dart_avg', () => {
    const session = makeSession({ gamePlayers: [makePlayer({ threeDartAvg: null })] });
    const rows = buildPlayerPayloads(session, CLOUD_SESSION_ID);
    expect(rows[0].three_dart_avg).toBeNull();
  });

  it('does not include an id field (DB generates UUID)', () => {
    const rows = buildPlayerPayloads(makeSession(), CLOUD_SESSION_ID);
    expect('id' in rows[0]).toBe(false);
  });
});

// ─── buildTurnPayloads ───────────────────────────────────────────────────────

describe('buildTurnPayloads', () => {
  it('returns empty array when session has no turns', () => {
    const rows = buildTurnPayloads(makeSession({ gameTurns: [] }), CLOUD_SESSION_ID);
    expect(rows).toHaveLength(0);
  });

  it('sets game_session_id to the cloud session id', () => {
    const rows = buildTurnPayloads(makeSession(), CLOUD_SESSION_ID);
    expect(rows[0].game_session_id).toBe(CLOUD_SESSION_ID);
  });

  it('resolves user_id and player_name from gamePlayers lookup', () => {
    const rows = buildTurnPayloads(makeSession(), CLOUD_SESSION_ID);
    expect(rows[0].user_id).toBe('user_abc');
    expect(rows[0].player_name).toBe('Alice');
  });

  it('falls back to Unknown when player not found', () => {
    const session = makeSession({
      gameTurns: [{ id: 99, playerId: 999, roundNumber: 1, darts: [], scoreDelta: 0 }],
    });
    const rows = buildTurnPayloads(session, CLOUD_SESSION_ID);
    expect(rows[0].player_name).toBe('Unknown');
    expect(rows[0].user_id).toBeNull();
  });

  it('sets round_number, darts, and score_delta', () => {
    const rows = buildTurnPayloads(makeSession(), CLOUD_SESSION_ID);
    expect(rows[0].round_number).toBe(1);
    expect(rows[0].darts).toEqual([{ segment: 20, multiplier: 3 }]);
    expect(rows[0].score_delta).toBe(60);
  });

  it('does not include an id field (DB generates UUID)', () => {
    const rows = buildTurnPayloads(makeSession(), CLOUD_SESSION_ID);
    expect('id' in rows[0]).toBe(false);
  });
});

// ─── syncCompletedSession with injected deps ─────────────────────────────────

type SupabaseChain = {
  data?: unknown;
  error?: { message: string } | null;
};

function makeFakeSupabase(responses: {
  upsertSession?: SupabaseChain;
  upsertPlayers?: SupabaseChain;
  deleteTurns?: SupabaseChain;
  insertTurns?: SupabaseChain;
} = {}) {
  const {
    upsertSession = { data: { id: CLOUD_SESSION_ID }, error: null },
    upsertPlayers = { data: null, error: null },
    deleteTurns = { data: null, error: null },
    insertTurns = { data: null, error: null },
  } = responses;

  const upsertCalls: string[] = [];
  const deleteCalls: string[] = [];
  const insertCalls: string[] = [];

  const client = {
    upsertCalls,
    deleteCalls,
    insertCalls,
    from: (table: string) => ({
      upsert: (data: unknown, opts?: unknown) => {
        upsertCalls.push(table);
        if (table === 'game_sessions') {
          return {
            select: () => ({ single: () => Promise.resolve(upsertSession) }),
          };
        }
        return Promise.resolve(upsertPlayers);
      },
      delete: () => {
        deleteCalls.push(table);
        return { eq: () => Promise.resolve(deleteTurns) };
      },
      insert: (data: unknown) => {
        insertCalls.push(table);
        return Promise.resolve(insertTurns);
      },
    }),
  };

  return client;
}

function makeFakeDb(session: ReturnType<typeof makeSession> | null, updateMock: ReturnType<typeof jest.fn>) {
  return {
    query: {
      gameSessions: {
        findFirst: jest.fn<() => Promise<typeof session>>().mockResolvedValue(session),
      },
    },
    update: () => ({
      set: (values: unknown) => ({
        where: () => updateMock(values),
      }),
    }),
  };
}

describe('syncCompletedSession', () => {
  let updateMock: jest.Mock<() => Promise<void>>;

  beforeEach(() => {
    updateMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  });

  const getToken = async () => 'fake-token';

  it('happy path: upserts session, players, deletes+inserts turns, marks synced', async () => {
    const fakeSupabase = makeFakeSupabase();
    const fakeDb = makeFakeDb(makeSession(), updateMock);

    const result = await syncCompletedSession(42, CLERK_USER_ID, getToken, {
      db: fakeDb as never,
      createSupabaseClient: () => fakeSupabase as never,
    });

    expect(result.cloudSessionId).toBe(CLOUD_SESSION_ID);
    expect(fakeSupabase.upsertCalls).toContain('game_sessions');
    expect(fakeSupabase.upsertCalls).toContain('game_players');
    expect(fakeSupabase.deleteCalls).toContain('game_turns');
    expect(fakeSupabase.insertCalls).toContain('game_turns');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ cloudSyncStatus: 'synced', cloudSessionId: CLOUD_SESSION_ID }),
    );
  });

  it('returns early without any calls when session is not completed', async () => {
    const fakeSupabase = makeFakeSupabase();
    const fakeDb = makeFakeDb(makeSession({ status: 'in_progress' }), updateMock);

    await syncCompletedSession(42, CLERK_USER_ID, getToken, {
      db: fakeDb as never,
      createSupabaseClient: () => fakeSupabase as never,
    });

    expect(fakeSupabase.upsertCalls).toHaveLength(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns early without any calls when session is not found', async () => {
    const fakeSupabase = makeFakeSupabase();
    const fakeDb = makeFakeDb(null, updateMock);

    await syncCompletedSession(42, CLERK_USER_ID, getToken, {
      db: fakeDb as never,
      createSupabaseClient: () => fakeSupabase as never,
    });

    expect(fakeSupabase.upsertCalls).toHaveLength(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('marks status as failed and re-throws when session upsert fails', async () => {
    const fakeSupabase = makeFakeSupabase({
      upsertSession: { data: null, error: { message: 'session upsert error' } },
    });
    const fakeDb = makeFakeDb(makeSession(), updateMock);

    await expect(
      syncCompletedSession(42, CLERK_USER_ID, getToken, {
        db: fakeDb as never,
        createSupabaseClient: () => fakeSupabase as never,
      }),
    ).rejects.toThrow('session upsert error');

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ cloudSyncStatus: 'failed' }),
    );
  });

  it('marks status as failed and re-throws when players upsert fails', async () => {
    const fakeSupabase = makeFakeSupabase({
      upsertPlayers: { data: null, error: { message: 'players upsert error' } },
    });
    const fakeDb = makeFakeDb(makeSession(), updateMock);

    await expect(
      syncCompletedSession(42, CLERK_USER_ID, getToken, {
        db: fakeDb as never,
        createSupabaseClient: () => fakeSupabase as never,
      }),
    ).rejects.toThrow('players upsert error');

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ cloudSyncStatus: 'failed' }),
    );
  });

  it('skips turn delete+insert when there are no turns', async () => {
    const fakeSupabase = makeFakeSupabase();
    const fakeDb = makeFakeDb(makeSession({ gameTurns: [] }), updateMock);

    await syncCompletedSession(42, CLERK_USER_ID, getToken, {
      db: fakeDb as never,
      createSupabaseClient: () => fakeSupabase as never,
    });

    expect(fakeSupabase.deleteCalls).toHaveLength(0);
    expect(fakeSupabase.insertCalls).toHaveLength(0);
  });

  it('marks status as failed and re-throws when turn delete fails', async () => {
    const fakeSupabase = makeFakeSupabase({
      deleteTurns: { data: null, error: { message: 'turns delete error' } },
    });
    const fakeDb = makeFakeDb(makeSession(), updateMock);

    await expect(
      syncCompletedSession(42, CLERK_USER_ID, getToken, {
        db: fakeDb as never,
        createSupabaseClient: () => fakeSupabase as never,
      }),
    ).rejects.toThrow('turns delete error');

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ cloudSyncStatus: 'failed' }),
    );
  });

  it('marks status as failed and re-throws when turn insert fails', async () => {
    const fakeSupabase = makeFakeSupabase({
      insertTurns: { data: null, error: { message: 'turns insert error' } },
    });
    const fakeDb = makeFakeDb(makeSession(), updateMock);

    await expect(
      syncCompletedSession(42, CLERK_USER_ID, getToken, {
        db: fakeDb as never,
        createSupabaseClient: () => fakeSupabase as never,
      }),
    ).rejects.toThrow('turns insert error');

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ cloudSyncStatus: 'failed' }),
    );
  });
});
