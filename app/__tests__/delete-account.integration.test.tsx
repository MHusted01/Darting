import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DeleteAccountScreen from '@/app/(protected)/delete-account';

const mockBack: jest.Mock<any> = jest.fn();
const mockReplace: jest.Mock<any> = jest.fn();
const mockUserDelete: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('@clerk/expo', () => ({
  useUser: () => ({
    user: { delete: mockUserDelete },
  }),
}));

describe('Delete Account Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockUserDelete.mockResolvedValue(undefined);
  });

  it('renders danger copy', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText(/permanently delete/i)).toBeTruthy();
  });

  it('back button calls router.back()', () => {
    render(<DeleteAccountScreen />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('delete button is disabled when input is empty', () => {
    render(<DeleteAccountScreen />);
    const btn = screen.getByLabelText('Confirm delete account');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('delete button is disabled when input is not exactly DELETE', () => {
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'delete');
    const btn = screen.getByLabelText('Confirm delete account');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('delete button is enabled when input is exactly DELETE', () => {
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'DELETE');
    const btn = screen.getByLabelText('Confirm delete account');
    expect(btn.props.accessibilityState?.disabled).toBe(false);
  });

  it('calls user.delete() and redirects on confirm', async () => {
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'DELETE');
    fireEvent.press(screen.getByLabelText('Confirm delete account'));

    await waitFor(() => {
      expect(mockUserDelete).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(public)/sign-in');
    });
  });

  it('shows error alert when deletion fails', async () => {
    mockUserDelete.mockRejectedValue({ message: 'Server error' });

    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'DELETE');
    fireEvent.press(screen.getByLabelText('Confirm delete account'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String));
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
