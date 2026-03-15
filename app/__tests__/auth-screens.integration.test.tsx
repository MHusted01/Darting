import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SignIn from '@/app/(public)/sign-in';
import SignUp from '@/app/(public)/sign-up';

const mockReplace: jest.Mock<any> = jest.fn();
const mockSignInPassword: jest.Mock<any> = jest.fn();
const mockSignInFinalize: jest.Mock<any> = jest.fn();
const mockSignUpPassword: jest.Mock<any> = jest.fn();
const mockSendEmailCode: jest.Mock<any> = jest.fn();
const mockVerifyEmailCode: jest.Mock<any> = jest.fn();
const mockSignUpFinalize: jest.Mock<any> = jest.fn();

let mockSignInStatus: 'needs_first_factor' | 'complete' = 'complete';
let mockSignUpStatus: 'missing_requirements' | 'complete' = 'complete';
let mockSignUpMissingFields: string[] = [];

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('@/components/SsoButtons', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(Text, null, 'SSO Buttons'),
  };
});

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

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@clerk/expo', () => ({
  useSignIn: () => ({
    fetchStatus: 'idle',
    signIn: {
      get status() {
        return mockSignInStatus;
      },
      password: mockSignInPassword,
      finalize: mockSignInFinalize,
    },
  }),
  useSignUp: () => ({
    fetchStatus: 'idle',
    signUp: {
      get status() {
        return mockSignUpStatus;
      },
      get missingFields() {
        return mockSignUpMissingFields;
      },
      password: mockSignUpPassword,
      finalize: mockSignUpFinalize,
      verifications: {
        sendEmailCode: mockSendEmailCode,
        verifyEmailCode: mockVerifyEmailCode,
      },
    },
  }),
}));

describe('Auth Screen Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInStatus = 'complete';
    mockSignUpStatus = 'complete';
    mockSignUpMissingFields = [];
    mockSignInFinalize.mockImplementation(async (options?: { navigate?: (params: { session?: { currentTask?: { key: string } } }) => void }) => {
      options?.navigate?.({ session: {} });
      return { error: null };
    });
    mockSignUpFinalize.mockImplementation(async (options?: { navigate?: (params: { session?: { currentTask?: { key: string } } }) => void }) => {
      options?.navigate?.({ session: {} });
      return { error: null };
    });
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('sign-in validates empty credentials', () => {
    render(<SignIn />);

    fireEvent.press(screen.getByTestId('sign-in-button'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter both email and password.');
  });

  it('sign-in completes and redirects on successful finalize', async () => {
    mockSignInPassword.mockResolvedValue({ error: null });
    mockSignInStatus = 'complete';

    render(<SignIn />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'super-secret');
    fireEvent.press(screen.getByTestId('sign-in-button'));

    await waitFor(() => {
      expect(mockSignInPassword).toHaveBeenCalledWith({
        identifier: 'user@example.com',
        password: 'super-secret',
      });
      expect(mockSignInFinalize).toHaveBeenCalledWith(
        expect.objectContaining({ navigate: expect.any(Function) }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(protected)/(tabs)');
    });
  });

  it('sign-in shows incomplete alert when status is not complete', async () => {
    mockSignInPassword.mockResolvedValue({ error: null });
    mockSignInStatus = 'needs_first_factor';

    render(<SignIn />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'super-secret');
    fireEvent.press(screen.getByTestId('sign-in-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign in incomplete',
        'Please complete additional verification to continue.',
      );
    });
  });

  it('sign-up happy path finalizes and redirects', async () => {
    mockSignUpPassword.mockResolvedValue({ error: null });
    mockSignUpStatus = 'complete';

    render(<SignUp />);

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Ada');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Lovelace');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ada@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'passw0rd!');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(mockSignUpPassword).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
        emailAddress: 'ada@example.com',
        password: 'passw0rd!',
      });
      expect(mockSignUpFinalize).toHaveBeenCalledWith(
        expect.objectContaining({ navigate: expect.any(Function) }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(protected)/(tabs)');
    });
  });

  it('sign-up enters verification flow when requirements remain', async () => {
    mockSignUpPassword.mockResolvedValue({ error: null });
    mockSendEmailCode.mockResolvedValue({ error: null });
    mockSignUpStatus = 'missing_requirements';

    render(<SignUp />);

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Ada');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Lovelace');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ada@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'passw0rd!');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(mockSendEmailCode).toHaveBeenCalled();
      expect(screen.getByText('Verify Email')).toBeTruthy();
    });
  });

  it('sign-up verification completes and redirects', async () => {
    mockSignUpPassword.mockResolvedValue({ error: null });
    mockSendEmailCode.mockResolvedValue({ error: null });
    mockVerifyEmailCode.mockResolvedValue({ error: null });
    mockSignUpStatus = 'missing_requirements';

    render(<SignUp />);

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Ada');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Lovelace');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ada@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'passw0rd!');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText('Submit OTP')).toBeTruthy();
    });

    mockSignUpStatus = 'complete';
    fireEvent.press(screen.getByText('Submit OTP'));

    await waitFor(() => {
      expect(mockVerifyEmailCode).toHaveBeenCalledWith({ code: '123456' });
      expect(mockSignUpFinalize).toHaveBeenCalledWith(
        expect.objectContaining({ navigate: expect.any(Function) }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(protected)/(tabs)');
    });
  });
});
