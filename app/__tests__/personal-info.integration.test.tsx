import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PersonalInfoScreen from '@/app/(protected)/personal-info';

const mockBack: jest.Mock<any> = jest.fn();
const mockUserUpdate: jest.Mock<any> = jest.fn();
const mockMaybeSingle: jest.Mock<any> = jest.fn();
const mockNeq: jest.Mock<any> = jest.fn();
const mockIlike: jest.Mock<any> = jest.fn();
const mockSelect: jest.Mock<any> = jest.fn();
const mockFrom: jest.Mock<any> = jest.fn();
const mockSetAvatarColor: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@clerk/expo', () => ({
  useUser: () => ({
    user: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada_lovelace',
      update: mockUserUpdate,
    },
  }),
  useAuth: () => ({ userId: 'user-123' }),
}));

jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ from: mockFrom }),
}));

jest.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    avatarColor: '#b8f0bc',
    setAvatarColor: mockSetAvatarColor,
  }),
}));

describe('Personal Info Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockUserUpdate.mockResolvedValue(undefined);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockNeq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockIlike.mockReturnValue({ neq: mockNeq });
    mockSelect.mockReturnValue({ ilike: mockIlike });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('renders pre-filled first name, last name, and username', () => {
    render(<PersonalInfoScreen />);
    expect(screen.getByDisplayValue('Ada')).toBeTruthy();
    expect(screen.getByDisplayValue('Lovelace')).toBeTruthy();
    expect(screen.getByDisplayValue('ada_lovelace')).toBeTruthy();
  });

  it('back button calls router.back()', () => {
    render(<PersonalInfoScreen />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('save calls user.update when username is unchanged', async () => {
    render(<PersonalInfoScreen />);
    fireEvent.changeText(screen.getByDisplayValue('Ada'), 'Alice');
    fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockUserUpdate).toHaveBeenCalledWith({
        firstName: 'Alice',
        lastName: 'Lovelace',
        username: 'ada_lovelace',
      });
    });
  });

  it('shows error when changed username is already taken', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'other-user' }, error: null });

    render(<PersonalInfoScreen />);
    fireEvent.changeText(screen.getByDisplayValue('ada_lovelace'), 'taken_name');
    fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Username already taken');
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  it('shows error when username format is invalid', async () => {
    render(<PersonalInfoScreen />);
    fireEvent.changeText(screen.getByDisplayValue('ada_lovelace'), 'bad username!');
    fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringMatching(/3.20 characters/i));
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  it('shows error when Supabase uniqueness lookup fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'Connection error' } });

    render(<PersonalInfoScreen />);
    fireEvent.changeText(screen.getByDisplayValue('ada_lovelace'), 'new_handle');
    fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Connection error');
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  it('saves when changed username is available', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    render(<PersonalInfoScreen />);
    fireEvent.changeText(screen.getByDisplayValue('ada_lovelace'), 'new_handle');
    fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(mockUserUpdate).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
        username: 'new_handle',
      });
    });
  });

  it('shows success alert after saving', async () => {
    render(<PersonalInfoScreen />);
    fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Saved', 'Your profile has been updated.');
    });
  });

  it('renders 6 avatar colour swatches', () => {
    render(<PersonalInfoScreen />);
    const swatches = screen.getAllByLabelText(/colour swatch/i);
    expect(swatches).toHaveLength(6);
  });

  it('tapping a colour swatch calls setAvatarColor', () => {
    render(<PersonalInfoScreen />);
    const swatches = screen.getAllByLabelText(/colour swatch/i);
    fireEvent.press(swatches[1]);
    expect(mockSetAvatarColor).toHaveBeenCalled();
  });
});
