import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/db/client', () => ({
  db: {
    query: {
      players: { findFirst: jest.fn() },
    },
    insert: jest.fn(),
  },
}));

jest.mock('@/db/schema', () => ({
  players: { userId: 'user_id', id: 'id' },
}));

import { getOrCreateUserPlayer, getUserPlayerId } from '@/lib/player';

type DbMock = {
  query: { players: { findFirst: jest.Mock<any> } };
  insert: jest.Mock<any>;
};

function makeInsertChain(rows: unknown[]) {
  return {
    values: jest.fn().mockReturnValue({
      onConflictDoUpdate: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(rows as never),
      }),
    }),
  };
}

describe('getOrCreateUserPlayer', () => {
  let dbMock: DbMock;

  beforeEach(() => {
    jest.clearAllMocks();
    dbMock = (require('@/db/client') as { db: DbMock }).db;
  });

  it('inserts and returns new player when none exists', async () => {
    dbMock.insert.mockReturnValue(
      makeInsertChain([{ id: 1, name: 'Alice', avatarColor: '#6366f1' }]),
    );

    const result = await getOrCreateUserPlayer('clerk-1', 'Alice');

    expect(result).toEqual({ id: 1, name: 'Alice', avatarColor: '#6366f1' });
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it('returns existing player via upsert when found (idempotent)', async () => {
    dbMock.insert.mockReturnValue(
      makeInsertChain([{ id: 5, name: 'Alice', avatarColor: '#10b981' }]),
    );

    const result = await getOrCreateUserPlayer('clerk-1', 'Alice');

    expect(result).toEqual({ id: 5, name: 'Alice', avatarColor: '#10b981' });
  });

  it('updates name via upsert when Clerk display name changed', async () => {
    dbMock.insert.mockReturnValue(
      makeInsertChain([{ id: 5, name: 'Alicia', avatarColor: '#10b981' }]),
    );

    const result = await getOrCreateUserPlayer('clerk-1', 'Alicia');

    expect(result.name).toBe('Alicia');
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it('preserves existing avatarColor — does not overwrite with default', async () => {
    dbMock.insert.mockReturnValue(
      makeInsertChain([{ id: 5, name: 'Alice', avatarColor: '#10b981' }]),
    );

    const result = await getOrCreateUserPlayer('clerk-1', 'Alice');

    expect(result.avatarColor).toBe('#10b981');
  });
});

describe('getUserPlayerId', () => {
  let dbMock: DbMock;

  beforeEach(() => {
    jest.clearAllMocks();
    dbMock = (require('@/db/client') as { db: DbMock }).db;
  });

  it('returns id when player row exists', async () => {
    dbMock.query.players.findFirst.mockResolvedValue({
      id: 7,
      name: 'Bob',
      avatarColor: '#6366f1',
      userId: 'clerk-2',
    });

    const result = await getUserPlayerId('clerk-2');

    expect(result).toBe(7);
  });

  it('returns null when no player row exists', async () => {
    dbMock.query.players.findFirst.mockResolvedValue(null);

    const result = await getUserPlayerId('clerk-3');

    expect(result).toBeNull();
  });

  it('never inserts — read-only lookup', async () => {
    dbMock.query.players.findFirst.mockResolvedValue(null);

    await getUserPlayerId('clerk-4');

    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
