import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import FriendProfileScreen from '@/app/(protected)/friend/[userId]';

const mockBack: jest.Mock<any> = jest.fn();
const mockRpc: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ userId: 'user-abc' }),
}));

jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ rpc: mockRpc }),
}));

jest.mock('@/hooks/useChallenges', () => ({
  useCreateChallenge: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query') as any;
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock<any> };

describe('Friend Profile Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<FriendProfileScreen />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('renders player name, games played, avg when data resolves', async () => {
    useQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        user_id: 'user-abc',
        first_name: 'Alice',
        last_name: 'Smith',
        username: 'alicesmith',
        games_played: 42,
        avg_three_dart_avg: 55.3,
        win_rate: 0.6,
        per_game_kpis: { x01: 55.3 },
      },
    });
    render(<FriendProfileScreen />);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getAllByText('55.3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('60%')).toBeTruthy();
  });

  it('renders dashes for null stats', () => {
    useQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        user_id: 'user-abc',
        first_name: 'Bob',
        last_name: null,
        username: 'bob99',
        games_played: 0,
        avg_three_dart_avg: null,
        win_rate: null,
        per_game_kpis: null,
      },
    });
    render(<FriendProfileScreen />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('back button calls router.back()', () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    render(<FriendProfileScreen />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders error message when query fails', () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<FriendProfileScreen />);
    expect(screen.getByText(/could not load/i)).toBeTruthy();
  });
});
