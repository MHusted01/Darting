import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert, Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/(protected)/settings';

const mockBack = jest.fn();
const mockReplace: jest.Mock<any> = jest.fn();
const mockPush: jest.Mock<any> = jest.fn();
const mockSignOut: jest.Mock<any> = jest.fn();
const mockSetNotifications: jest.Mock<any> = jest.fn();
const mockSetSoundEffects: jest.Mock<any> = jest.fn();

const mockEq: jest.Mock<any> = jest.fn();
const mockUpdate: jest.Mock<any> = jest.fn();
const mockFrom: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: mockPush }),
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ signOut: mockSignOut, userId: 'user-123' }),
  useUser: () => ({
    user: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      primaryEmailAddress: { emailAddress: 'ada@example.com' },
    },
  }),
}));

jest.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    notifications: true,
    soundEffects: false,
    setNotifications: mockSetNotifications,
    setSoundEffects: mockSetSoundEffects,
  }),
}));

jest.mock('@/constants/links', () => ({
  PRIVACY_POLICY_URL: 'https://example.com/privacy',
}));

jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ from: mockFrom }),
}));

describe('Settings Screen Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockSignOut.mockResolvedValue(undefined);
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it('renders user display name and email', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('ada@example.com')).toBeTruthy();
  });

  it('back button navigates back', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockBack).toHaveBeenCalled();
  });

  it('sign-out clears push token before signing out', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Log out'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith({ push_token: null });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        mockSignOut.mock.invocationCallOrder[0],
      );
    });
  });

  it('sign-out calls signOut and redirects to sign-in on success', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Log out'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(public)/sign-in');
    });
  });

  it('sign-out shows alert on error', async () => {
    mockSignOut.mockRejectedValue({ errors: [{ message: 'Network error' }] });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Log out'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Network error');
    });
  });

  it('Subscription row shows the current plan without a Coming Soon alert', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Subscription')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Coming Soon',
      'Subscription settings will be available soon.',
    );
  });

  it('Personal Info row navigates to personal-info screen', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Personal Info'));
    expect(mockPush).toHaveBeenCalledWith('/(protected)/personal-info');
  });

  it('Security row navigates to security screen', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Security'));
    expect(mockPush).toHaveBeenCalledWith('/(protected)/security');
  });

  it('Notification Preferences row navigates to notification-prefs screen', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Notification Preferences'));
    expect(mockPush).toHaveBeenCalledWith('/(protected)/notification-prefs');
  });

  it('Help Center row navigates to help-center screen', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Help Center'));
    expect(mockPush).toHaveBeenCalledWith('/(protected)/help-center');
  });

  it('Privacy Policy row opens URL in system browser', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Privacy Policy'));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/privacy');
    });
  });

  it('Delete Account row navigates to delete-account screen', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Delete Account'));
    expect(mockPush).toHaveBeenCalledWith('/(protected)/delete-account');
  });
});
