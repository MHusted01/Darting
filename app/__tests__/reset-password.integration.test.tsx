import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ResetPassword from '@/app/(public)/reset-password';

const mockReplace: jest.Mock<any> = jest.fn();
const mockBack: jest.Mock<any> = jest.fn();
const mockCreate: jest.Mock<any> = jest.fn();
const mockAttemptFirstFactor: jest.Mock<any> = jest.fn();
const mockResetPassword: jest.Mock<any> = jest.fn();
const mockFinalize: jest.Mock<any> = jest.fn();

let mockSignInStatus: 'needs_first_factor' | 'needs_new_password' | 'complete' = 'needs_first_factor';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

jest.mock('@/components/OtpInput', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ onComplete }: { onComplete: (code: string) => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress: () => onComplete('123456') },
        React.createElement(Text, null, 'Submit OTP'),
      ),
  };
});

jest.mock('@clerk/expo', () => ({
  useSignIn: () => ({
    fetchStatus: 'idle',
    signIn: {
      get status() {
        return mockSignInStatus;
      },
      create: mockCreate,
      attemptFirstFactor: mockAttemptFirstFactor,
      resetPassword: mockResetPassword,
      finalize: mockFinalize,
    },
  }),
}));

describe('Reset Password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInStatus = 'needs_first_factor';
    mockFinalize.mockImplementation(
      async (options?: { navigate?: () => void }) => {
        options?.navigate?.();
        return { error: null };
      },
    );
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('renders email step by default', () => {
    render(<ResetPassword />);
    expect(screen.getByPlaceholderText('player@example.com')).toBeTruthy();
    expect(screen.queryByText('Submit OTP')).toBeNull();
  });

  it('validates empty email on submit', () => {
    render(<ResetPassword />);
    fireEvent.press(screen.getByTestId('reset-send-button'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter your email address.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('calls signIn.create with reset_password_email_code strategy', async () => {
    mockCreate.mockResolvedValue({ error: null });

    render(<ResetPassword />);
    fireEvent.changeText(screen.getByPlaceholderText('player@example.com'), 'user@example.com');
    fireEvent.press(screen.getByTestId('reset-send-button'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        strategy: 'reset_password_email_code',
        identifier: 'user@example.com',
      });
    });
  });

  it('shows OTP step after successful email submit', async () => {
    mockCreate.mockResolvedValue({ error: null });

    render(<ResetPassword />);
    fireEvent.changeText(screen.getByPlaceholderText('player@example.com'), 'user@example.com');
    fireEvent.press(screen.getByTestId('reset-send-button'));

    await waitFor(() => {
      expect(screen.getByText('Submit OTP')).toBeTruthy();
    });
  });

  it('shows error alert when signIn.create fails', async () => {
    mockCreate.mockResolvedValue({ error: { message: 'Email not found' } });

    render(<ResetPassword />);
    fireEvent.changeText(screen.getByPlaceholderText('player@example.com'), 'bad@example.com');
    fireEvent.press(screen.getByTestId('reset-send-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String));
    });
    expect(screen.queryByText('Submit OTP')).toBeNull();
  });

  it('calls attemptFirstFactor with OTP code', async () => {
    mockCreate.mockResolvedValue({ error: null });
    mockAttemptFirstFactor.mockResolvedValue({ error: null });
    mockSignInStatus = 'needs_new_password';

    render(<ResetPassword />);
    fireEvent.changeText(screen.getByPlaceholderText('player@example.com'), 'user@example.com');
    fireEvent.press(screen.getByTestId('reset-send-button'));

    await waitFor(() => screen.getByText('Submit OTP'));
    fireEvent.press(screen.getByText('Submit OTP'));

    await waitFor(() => {
      expect(mockAttemptFirstFactor).toHaveBeenCalledWith({
        strategy: 'reset_password_email_code',
        code: '123456',
      });
    });
  });

  it('shows new password step after valid OTP', async () => {
    mockCreate.mockResolvedValue({ error: null });
    mockAttemptFirstFactor.mockResolvedValue({ error: null });
    mockSignInStatus = 'needs_new_password';

    render(<ResetPassword />);
    fireEvent.changeText(screen.getByPlaceholderText('player@example.com'), 'user@example.com');
    fireEvent.press(screen.getByTestId('reset-send-button'));

    await waitFor(() => screen.getByText('Submit OTP'));
    fireEvent.press(screen.getByText('Submit OTP'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New password')).toBeTruthy();
    });
  });

  it('validates empty password on reset submit', async () => {
    mockCreate.mockResolvedValue({ error: null });
    mockAttemptFirstFactor.mockResolvedValue({ error: null });
    mockSignInStatus = 'needs_new_password';

    render(<ResetPassword />);
    fireEvent.changeText(screen.getByPlaceholderText('player@example.com'), 'user@example.com');
    fireEvent.press(screen.getByTestId('reset-send-button'));

    await waitFor(() => screen.getByText('Submit OTP'));
    fireEvent.press(screen.getByText('Submit OTP'));

    await waitFor(() => screen.getByPlaceholderText('New password'));
    fireEvent.press(screen.getByTestId('reset-submit-button'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a new password.');
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword and finalizes on success', async () => {
    mockCreate.mockResolvedValue({ error: null });
    mockAttemptFirstFactor.mockResolvedValue({ error: null });
    mockResetPassword.mockResolvedValue({ error: null });
    mockSignInStatus = 'needs_new_password';

    render(<ResetPassword />);
    fireEvent.changeText(screen.getByPlaceholderText('player@example.com'), 'user@example.com');
    fireEvent.press(screen.getByTestId('reset-send-button'));

    await waitFor(() => screen.getByText('Submit OTP'));
    fireEvent.press(screen.getByText('Submit OTP'));

    await waitFor(() => screen.getByPlaceholderText('New password'));

    mockSignInStatus = 'complete';
    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'newpassword123');
    fireEvent.press(screen.getByTestId('reset-submit-button'));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({ password: 'newpassword123' });
      expect(mockFinalize).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(protected)/(tabs)');
    });
  });

  it('back button navigates back', () => {
    render(<ResetPassword />);
    fireEvent.press(screen.getByAccessibilityHint('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
