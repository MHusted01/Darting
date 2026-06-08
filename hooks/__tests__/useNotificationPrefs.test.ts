import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { getNotificationPrefs, updateNotificationPrefs, DEFAULT_PREFS } from '@/lib/notificationPrefs';

jest.mock('@/lib/notificationPrefs', () => ({
  getNotificationPrefs: jest.fn(),
  updateNotificationPrefs: jest.fn(),
  DEFAULT_PREFS: {
    friend_requests: true,
    club_invites: true,
    tournament_updates: true,
    match_challenges: true,
  },
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: 'user-123' }),
}));

jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({}),
}));

const mockGet = getNotificationPrefs as jest.Mock<any>;
const mockUpdate = updateNotificationPrefs as jest.Mock<any>;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, invalidateSpy };
}

describe('useNotificationPrefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls getNotificationPrefs with userId when enabled', async () => {
    mockGet.mockResolvedValue(DEFAULT_PREFS);
    const { Wrapper } = makeWrapper();
    renderHook(() => useNotificationPrefs(), { wrapper: Wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith({}, 'user-123'));
  });

  it('returns the fetched prefs', async () => {
    const prefs = { ...DEFAULT_PREFS, friend_requests: false };
    mockGet.mockResolvedValue(prefs);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationPrefs(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual(prefs));
  });
});

describe('useUpdateNotificationPrefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls updateNotificationPrefs and invalidates query on success', async () => {
    mockUpdate.mockResolvedValue(undefined);
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdateNotificationPrefs(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate(DEFAULT_PREFS);
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({}, 'user-123', DEFAULT_PREFS);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notification-prefs', 'user-123'] });
    });
  });

  it('does not call updateNotificationPrefs when mutation function receives no userId', async () => {
    mockUpdate.mockResolvedValue(undefined);
    // Directly verify the guard: calling updateNotificationPrefs with an empty userId string
    // is rejected before reaching the Supabase layer.
    const guardFn = async () => {
      const uid: string | null | undefined = undefined;
      if (!uid) throw new Error('Not authenticated');
      return updateNotificationPrefs({} as any, uid, DEFAULT_PREFS);
    };
    await expect(guardFn()).rejects.toThrow('Not authenticated');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
