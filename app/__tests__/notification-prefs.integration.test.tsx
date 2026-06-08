import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import NotificationPrefsScreen from '@/app/(protected)/notification-prefs';

const mockBack: jest.Mock<any> = jest.fn();
const mockMutate: jest.Mock<any> = jest.fn();

const mockDefaultPrefs = {
  friend_requests: true,
  club_invites: true,
  tournament_updates: true,
  match_challenges: true,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/hooks/useNotificationPrefs', () => ({
  useNotificationPrefs: () => ({
    data: {
      friend_requests: true,
      club_invites: true,
      tournament_updates: true,
      match_challenges: true,
    },
    isLoading: false,
  }),
  useUpdateNotificationPrefs: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe('Notification Preferences Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all four toggle rows', () => {
    render(<NotificationPrefsScreen />);
    expect(screen.getByText('Friend Requests')).toBeTruthy();
    expect(screen.getByText('Club Invites')).toBeTruthy();
    expect(screen.getByText('Tournament Updates')).toBeTruthy();
    expect(screen.getByText('Match Challenges')).toBeTruthy();
  });

  it('back button calls router.back()', () => {
    render(<NotificationPrefsScreen />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('toggling Friend Requests calls mutate with updated prefs', async () => {
    render(<NotificationPrefsScreen />);

    fireEvent(screen.getByLabelText('Toggle friend requests notifications'), 'valueChange', false);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { ...mockDefaultPrefs, friend_requests: false },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });
  });

  it('toggling Club Invites calls mutate with updated prefs', async () => {
    render(<NotificationPrefsScreen />);

    fireEvent(screen.getByLabelText('Toggle club invites notifications'), 'valueChange', false);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { ...mockDefaultPrefs, club_invites: false },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });
  });

  it('renders toggles when data is loaded', () => {
    render(<NotificationPrefsScreen />);
    expect(screen.getByText('Friend Requests')).toBeTruthy();
  });
});
