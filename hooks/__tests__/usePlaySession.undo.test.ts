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
  syncCompletedSession: jest.fn(),
}));

jest.mock('@/lib/haptics', () => ({
  impact: jest.fn(),
  notify: jest.fn(),
  selection: jest.fn(),
}));

jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => null);

const mockFindFirst = db.query.gameSessions.findFirst as jest.Mock<any>;
const mockTransaction = db.transaction as jest.Mock<any>;

function session(gameSlug: string, playerState: object, config: object) {
  return {
    id: 7,
    gameSlug,
    status: 'in_progress',
    currentRound: 1,
    currentPlayerIndex: 0,
    config,
    gamePlayers: [
      {
        id: 11,
        playerId: 1,
        playerOrder: 0,
        currentScore: 0,
        gameState: playerState,
        isWinner: false,
        player: { name: 'Me', avatarColor: '#fff', userId: 'user-123' },
      },
      {
        id: 12,
        playerId: 2,
        playerOrder: 1,
        currentScore: 0,
        gameState: { ...playerState },
        isWinner: false,
        player: { name: 'Opponent', avatarColor: '#000', userId: 'user-456' },
      },
    ],
  };
}

describe('usePlaySession undoLastDart — X01', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockResolvedValue(undefined);
    mockFindFirst.mockResolvedValue(
      session('x01', { remaining: 501 }, { startingScore: 501 }),
    );
  });

  it('removes the last dart and restores the local X01 state', async () => {
    const { result } = renderHook(() => usePlaySession({ slug: 'x01', sessionId: '7' }));
    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.handleX01DartThrown({ segment: 20, multiplier: 3 });
    });
    await act(async () => {
      await result.current.handleX01DartThrown({ segment: 5, multiplier: 1 });
    });
    expect(result.current.turnDarts).toHaveLength(2);
    expect(result.current.localX01State?.remaining).toBe(436);

    act(() => {
      result.current.undoLastDart();
    });
    expect(result.current.turnDarts).toHaveLength(1);
    expect(result.current.localX01State?.remaining).toBe(441);

    act(() => {
      result.current.undoLastDart();
    });
    expect(result.current.turnDarts).toHaveLength(0);
    expect(result.current.localX01State?.remaining).toBe(501);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('is a no-op when no darts have been thrown this turn', async () => {
    const { result } = renderHook(() => usePlaySession({ slug: 'x01', sessionId: '7' }));
    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    act(() => {
      result.current.undoLastDart();
    });
    expect(result.current.turnDarts).toHaveLength(0);
    expect(result.current.localX01State?.remaining).toBe(501);
  });
});

describe('usePlaySession undoLastDart — Around the Clock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockResolvedValue(undefined);
    mockFindFirst.mockResolvedValue(
      session('around-the-clock', { currentTarget: 1 }, { includeBull: false }),
    );
  });

  it('restores the local target when a hit is undone', async () => {
    const { result } = renderHook(() =>
      usePlaySession({ slug: 'around-the-clock', sessionId: '7' }),
    );
    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.handleATCDartThrown({ segment: 1, multiplier: 1 });
    });
    expect(result.current.localTarget).toBe(2);
    expect(result.current.turnDarts).toHaveLength(1);

    act(() => {
      result.current.undoLastDart();
    });
    expect(result.current.localTarget).toBe(1);
    expect(result.current.turnDarts).toHaveLength(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
