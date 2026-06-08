import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRemoveFriend } from '@/hooks/useFriends';
import { removeFriend } from '@/lib/friends';

jest.mock('@/lib/friends', () => ({
  removeFriend: jest.fn(),
  getFriends: jest.fn(),
  getPendingRequests: jest.fn(),
  searchUsers: jest.fn(),
  sendFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  declineFriendRequest: jest.fn(),
  mapFriendRow: jest.fn(),
  mergePresence: jest.fn(),
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: 'user-123' }),
}));

jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({}),
}));

const mockRemoveFriend = removeFriend as jest.Mock<any>;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, invalidateSpy };
}

describe('useRemoveFriend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls removeFriend with the correct friendshipId and userId', async () => {
    mockRemoveFriend.mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveFriend(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('friendship-abc');
    });

    await waitFor(() => expect(mockRemoveFriend).toHaveBeenCalledWith({}, 'friendship-abc', 'user-123'));
  });

  it('invalidates the friends query on success', async () => {
    mockRemoveFriend.mockResolvedValue(undefined);
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRemoveFriend(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('friendship-abc');
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends'] }));
  });

  it('surfaces errors via the mutation error state', async () => {
    mockRemoveFriend.mockRejectedValue(new Error('RLS violation'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveFriend(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('friendship-abc');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
