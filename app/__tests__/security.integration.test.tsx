import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SecurityScreen from '@/app/(protected)/security';

const mockBack: jest.Mock<any> = jest.fn();
const mockUpdatePassword: jest.Mock<any> = jest.fn();

const mockLastActiveAt = new Date('2026-01-15T10:30:00Z');

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@clerk/expo', () => ({
  useUser: () => ({
    user: {
      updatePassword: mockUpdatePassword,
    },
  }),
  useSession: () => ({
    session: { lastActiveAt: mockLastActiveAt },
  }),
}));

describe('Security Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  it('renders last sign-in date', () => {
    render(<SecurityScreen />);
    expect(screen.getByText(/last sign.in/i)).toBeTruthy();
  });

  it('back button calls router.back()', () => {
    render(<SecurityScreen />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows error when fields are empty', () => {
    render(<SecurityScreen />);
    fireEvent.press(screen.getByLabelText('Save password'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all password fields.');
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('shows error when new passwords do not match', () => {
    render(<SecurityScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Current password'), 'oldpass');
    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'newpass1');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'newpass2');
    fireEvent.press(screen.getByLabelText('Save password'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'New passwords do not match.');
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('calls user.updatePassword with correct args on valid input', async () => {
    render(<SecurityScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Current password'), 'oldpass123');
    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'newpass123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'newpass123');
    fireEvent.press(screen.getByLabelText('Save password'));

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith({
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        signOutOfOtherSessions: false,
      });
    });
  });

  it('shows success alert on password update', async () => {
    render(<SecurityScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Current password'), 'old');
    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'new123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'new123');
    fireEvent.press(screen.getByLabelText('Save password'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Password updated', 'Your password has been changed.');
    });
  });

  it('shows error alert on failure', async () => {
    mockUpdatePassword.mockRejectedValue({ message: 'Incorrect password' });

    render(<SecurityScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Current password'), 'wrong');
    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'new123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'new123');
    fireEvent.press(screen.getByLabelText('Save password'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String));
    });
  });
});
