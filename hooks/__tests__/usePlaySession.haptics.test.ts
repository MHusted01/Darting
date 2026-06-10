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

const haptics = jest.requireMock('@/lib/haptics') as {
  impact: jest.Mock;
  notify: jest.Mock;
};

const mockFindFirst = db.query.gameSessions.findFirst as jest.Mock<any>;
const mockTransaction = db.transaction as jest.Mock<any>;

function x01Session(remaining = 501) {
  return {
    id: 7,
    gameSlug: 'x01',
    status: 'in_progress',
    currentRound: 1,
    currentPlayerIndex: 0,
    config: { startingScore: 501 },
    gamePlayers: [
      {
        id: 11,
        playerId: 1,
        playerOrder: 0,
        currentScore: 0,
        gameState: { remaining },
        isWinner: false,
        player: { name: 'Me', avatarColor: '#fff', userId: 'user-123' },
      },
      {
        id: 12,
        playerId: 2,
        playerOrder: 1,
        currentScore: 0,
        gameState: { remaining: 501 },
        isWinner: false,
        player: { name: 'Opponent', avatarColor: '#000', userId: 'user-456' },
      },
    ],
  };
}

describe('usePlaySession haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockResolvedValue(undefined);
  });

  it('fires an impact haptic when a turn is committed', async () => {
    mockFindFirst.mockResolvedValue(x01Session(501));
    const { result } = renderHook(() => usePlaySession({ slug: 'x01', sessionId: '7' }));
    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.handleX01DartThrown({ segment: 20, multiplier: 3 });
    });
    await act(async () => {
      await result.current.handleX01DartThrown({ segment: 20, multiplier: 3 });
    });
    await act(async () => {
      await result.current.handleX01DartThrown({ segment: 20, multiplier: 1 });
    });

    expect(mockTransaction).toHaveBeenCalled();
    expect(haptics.impact).toHaveBeenCalled();
    expect(haptics.notify).not.toHaveBeenCalled();
  });

  it('fires a success haptic when the game completes', async () => {
    mockFindFirst.mockResolvedValue(x01Session(40));
    const { result } = renderHook(() => usePlaySession({ slug: 'x01', sessionId: '7' }));
    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.handleX01DartThrown({ segment: 20, multiplier: 2 });
    });

    expect(mockTransaction).toHaveBeenCalled();
    expect(haptics.notify).toHaveBeenCalledWith('success');
  });
});
