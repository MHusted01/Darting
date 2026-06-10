/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useIncomingChallenges,
  useAcceptChallenge,
  useDeclineChallenge,
  useCancelChallenge,
  useCreateChallenge,
} from '@/hooks/useChallenges';
import {
  acceptChallenge,
  cancelChallenge,
  createChallenge,
  declineChallenge,
  listIncomingChallenges,
} from '@/lib/realtime-api';

jest.mock('@/lib/realtime-api', () => ({
  acceptChallenge: jest.fn(),
  cancelChallenge: jest.fn(),
  createChallenge: jest.fn(),
  declineChallenge: jest.fn(),
  listIncomingChallenges: jest.fn(),
  listOutgoingChallenges: jest.fn(),
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: 'user-123' }),
}));

jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({}),
}));

const mockList = listIncomingChallenges as jest.Mock<any>;
const mockAccept = acceptChallenge as jest.Mock<any>;
const mockDecline = declineChallenge as jest.Mock<any>;
const mockCancel = cancelChallenge as jest.Mock<any>;
const mockCreate = createChallenge as jest.Mock<any>;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, invalidateSpy };
}

describe('useIncomingChallenges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches incoming challenges for the signed-in user', async () => {
    mockList.mockResolvedValue([{ id: 'challenge-1' }]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncomingChallenges(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual([{ id: 'challenge-1' }]));
    expect(mockList).toHaveBeenCalledWith({}, 'user-123');
  });
});

describe('challenge mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useAcceptChallenge accepts and invalidates challenge queries', async () => {
    mockAccept.mockResolvedValue(true);
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAcceptChallenge(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('challenge-1');
    });

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith({}, 'challenge-1'));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['challenges'] }),
    );
  });

  it('useDeclineChallenge declines', async () => {
    mockDecline.mockResolvedValue(true);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeclineChallenge(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('challenge-1');
    });

    await waitFor(() => expect(mockDecline).toHaveBeenCalledWith({}, 'challenge-1'));
  });

  it('useCancelChallenge cancels', async () => {
    mockCancel.mockResolvedValue(true);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelChallenge(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('challenge-1');
    });

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith({}, 'challenge-1'));
  });

  it('useCreateChallenge inserts with the signed-in user as challenger', async () => {
    mockCreate.mockResolvedValue('challenge-9');
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateChallenge(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ challengeeId: 'user-456', gameSlug: 'x01', settings: { startingScore: 501 } });
    });

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({}, {
        challengerId: 'user-123',
        challengeeId: 'user-456',
        gameSlug: 'x01',
        settings: { startingScore: 501 },
      }),
    );
  });
});
