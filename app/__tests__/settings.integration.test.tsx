import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/(protected)/settings';

const mockBack = jest.fn();
const mockReplace: jest.Mock<any> = jest.fn();
const mockSignOut: jest.Mock<any> = jest.fn();
const mockSetNotifications: jest.Mock<any> = jest.fn();
const mockSetSoundEffects: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ signOut: mockSignOut }),
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

describe('Settings Screen Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
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

  it('sign-out calls signOut and redirects to sign-in on success', async () => {
    mockSignOut.mockResolvedValue(undefined);

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
});
