/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePlaySession } from '@/hooks/usePlaySession';
import { db } from '@/db/client';

jest.mock('@/db/client', () => ({
  db: {
    query: {
      gameSessions: {
        findFirst: jest.fn(),
      },
    },
    transaction: jest.fn(),
  },
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: 'user-123', getToken: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('@/lib/supabase-sync', () => ({
  syncCompletedSession: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.mock('@/lib/haptics', () => ({
  impact: jest.fn(),
  notify: jest.fn(),
  selection: jest.fn(),
}));

jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => null);

const mockFindFirst = db.query.gameSessions.findFirst as jest.Mock<any>;
const mockTransaction = db.transaction as jest.Mock<any>;

type TurnRow = { playerId: number; roundNumber: number; darts: unknown; scoreDelta: number };

function makeTx(turnRows: TurnRow[]) {
  const setPayloads: Record<string, unknown>[] = [];
  const tx = {
    insert: jest.fn(() => ({ values: jest.fn<any>().mockResolvedValue(undefined) })),
    update: jest.fn(() => ({
      set: (payload: Record<string, unknown>) => {
        setPayloads.push(payload);
        return { where: jest.fn<any>().mockResolvedValue(undefined) };
      },
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn<any>().mockResolvedValue(turnRows),
        })),
      })),
    })),
  };
  return { tx, setPayloads };
}

function session(overrides: Record<string, unknown>) {
  return {
    id: 7,
    status: 'in_progress',
    currentRound: 1,
    currentPlayerIndex: 0,
    gamePlayers: [
      {
        id: 11,
        playerId: 1,
        playerOrder: 0,
        currentScore: 0,
        isWinner: false,
        player: { name: 'Me', avatarColor: '#fff', userId: 'user-123' },
        ...((overrides as any).playerOverrides ?? {}),
      },
    ],
    ...overrides,
  };
}

describe('usePlaySession threeDartAvg storage on completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores a numeric threeDartAvg for x01 sessions', async () => {
    const { tx, setPayloads } = makeTx([
      { playerId: 1, roundNumber: 1, darts: [{ segment: 20, multiplier: 2 }], scoreDelta: 40 },
    ]);
    mockTransaction.mockImplementation(async (fn: any) => fn(tx));
    mockFindFirst.mockResolvedValue(
      session({
        gameSlug: 'x01',
        config: { startingScore: 501 },
        playerOverrides: { gameState: { remaining: 40 } },
      }),
    );

    const { result } = renderHook(() => usePlaySession({ slug: 'x01', sessionId: '7' }));
    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.handleX01DartThrown({ segment: 20, multiplier: 2 });
    });

    const avgPayload = setPayloads.find((p) => 'threeDartAvg' in p);
    expect(avgPayload).toBeDefined();
    expect(avgPayload!.threeDartAvg).toBeCloseTo(120, 5);
  });

  it('stores null threeDartAvg for non-x01 sessions', async () => {
    const { tx, setPayloads } = makeTx([
      { playerId: 1, roundNumber: 1, darts: [{ segment: 20, multiplier: 1 }], scoreDelta: 1 },
    ]);
    mockTransaction.mockImplementation(async (fn: any) => fn(tx));
    mockFindFirst.mockResolvedValue(
      session({
        gameSlug: 'around-the-clock',
        config: { includeBull: false },
        playerOverrides: { gameState: { currentTarget: 20 } },
      }),
    );

    const { result } = renderHook(() =>
      usePlaySession({ slug: 'around-the-clock', sessionId: '7' }),
    );
    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.handleATCDartThrown({ segment: 20, multiplier: 1 });
    });

    const avgPayload = setPayloads.find((p) => 'threeDartAvg' in p);
    expect(avgPayload).toBeDefined();
    expect(avgPayload!.threeDartAvg).toBeNull();
  });
});
