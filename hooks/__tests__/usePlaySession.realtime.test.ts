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

jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => null);

const mockFindFirst = db.query.gameSessions.findFirst as jest.Mock<any>;
const mockTransaction = db.transaction as jest.Mock<any>;

function x01Session(currentPlayerIndex = 0) {
  return {
    id: 7,
    gameSlug: 'x01',
    status: 'in_progress',
    currentRound: 1,
    currentPlayerIndex,
    config: { startingScore: 501 },
    gamePlayers: [
      {
        id: 11,
        playerId: 1,
        playerOrder: 0,
        currentScore: 0,
        gameState: { remaining: 501 },
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

describe('usePlaySession realtime extensions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(x01Session());
    mockTransaction.mockResolvedValue(undefined);
  });

  it('blocks local turn persistence when onBeforeCommitTurn rejects', async () => {
    const onBeforeCommitTurn = jest
      .fn<any>()
      .mockRejectedValue(new Error('not_your_turn'));

    const { result } = renderHook(() =>
      usePlaySession({ slug: 'x01', sessionId: '7', onBeforeCommitTurn }),
    );

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

    expect(onBeforeCommitTurn).toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('commits the local turn when onBeforeCommitTurn resolves', async () => {
    const onBeforeCommitTurn = jest.fn<any>().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      usePlaySession({ slug: 'x01', sessionId: '7', onBeforeCommitTurn }),
    );

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

    expect(onBeforeCommitTurn).toHaveBeenCalledWith(
      expect.any(Array),
      false,
      undefined,
      expect.objectContaining({ sessionId: 7 }),
      140,
    );
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('applyRemoteTurn ignores turns broadcast by the local user', async () => {
    const { result } = renderHook(() => usePlaySession({ slug: 'x01', sessionId: '7' }));

    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.applyRemoteTurn(
        [{ segment: 20, multiplier: 3 }],
        'user-123',
        'user-123',
      );
    });

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('applyRemoteTurn ignores a turn that does not belong to the current player', async () => {
    mockFindFirst.mockResolvedValue(x01Session(0));
    const { result } = renderHook(() => usePlaySession({ slug: 'x01', sessionId: '7' }));

    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.applyRemoteTurn(
        [{ segment: 20, multiplier: 3 }],
        'user-456',
        'user-123',
      );
    });

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('applyRemoteTurn commits a remote turn without invoking onBeforeCommitTurn', async () => {
    const onBeforeCommitTurn = jest.fn<any>().mockResolvedValue(undefined);
    mockFindFirst.mockResolvedValue(x01Session(1));

    const { result } = renderHook(() =>
      usePlaySession({ slug: 'x01', sessionId: '7', onBeforeCommitTurn }),
    );

    await waitFor(() => expect(result.current.gameState).not.toBeNull());

    await act(async () => {
      await result.current.applyRemoteTurn(
        [
          { segment: 20, multiplier: 3 },
          { segment: 20, multiplier: 3 },
          { segment: 20, multiplier: 1 },
        ],
        'user-456',
        'user-123',
      );
    });

    expect(onBeforeCommitTurn).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalled();
  });
});
