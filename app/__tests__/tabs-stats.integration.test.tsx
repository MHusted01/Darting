import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TabsLayout from '@/app/(protected)/(tabs)/_layout';
import StatsScreen from '@/app/(protected)/(tabs)/stats';

const mockPush: jest.Mock<any> = jest.fn();
const mockRefetch: jest.Mock<any> = jest.fn();
const mockUseQuery: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => {
  const TabsMockFunction = function TabsMock({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
  const TabsScreenFunction = function TabsScreen({ name }: { name: string }) {
    const React = jest.requireActual('react') as typeof import('react');
    const { Text } = jest.requireActual('react-native') as typeof import('react-native');
    return React.createElement(Text, null, `tab:${name}`);
  };
  const TabsMock = Object.assign(TabsMockFunction, {
    Screen: TabsScreenFunction,
  });

  return {
    Tabs: TabsMock,
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: jest.fn((effect: () => void | (() => void)) => effect()),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock('@/lib/history', () => ({
  getHistoryData: jest.fn(),
}));

jest.mock('@/lib/stats', () => ({
  getPersonalBests: jest.fn(),
  getOverallThreeDartAvg: jest.fn(),
}));

jest.mock('@/constants/games', () => ({
  GAMES: [
    { slug: 'x01', name: '501 / 301' },
    { slug: 'cricket', name: 'Cricket' },
  ],
  IMPLEMENTED_SLUGS: new Set(['x01', 'cricket']),
}));

describe('Tabs + Stats Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('renders all tab entries in tabs layout', () => {
    render(<TabsLayout />);

    expect(screen.getByText('tab:index')).toBeTruthy();
    expect(screen.getByText('tab:stats')).toBeTruthy();
    expect(screen.getByText('tab:social')).toBeTruthy();
  });

  const emptyQueryResult = {
    data: undefined,
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  };

  it('renders stats loading state', () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'history') {
        return { data: undefined, isLoading: true, isRefetching: false, error: null, refetch: mockRefetch };
      }
      return emptyQueryResult;
    });

    render(<StatsScreen />);

    expect(screen.getByText('Loading stats...')).toBeTruthy();
  });

  it('renders stats data and routes by status', async () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'history') {
        return {
          data: {
            quickStats: {
              gamesPlayed: 3,
              completedCount: 1,
              winRate: 33,
              inProgressSessions: 1,
              abandonedSessions: 1,
            },
            sessions: [
              {
                sessionId: 1,
                gameSlug: 'cricket',
                gameName: 'Cricket',
                status: 'setup',
                playerCount: 2,
                currentRound: 1,
                winnerName: null,
                lastActivityAt: new Date('2026-03-14T12:00:00Z'),
              },
              {
                sessionId: 2,
                gameSlug: 'x01',
                gameName: 'X01',
                status: 'in_progress',
                playerCount: 2,
                currentRound: 4,
                winnerName: null,
                lastActivityAt: new Date('2026-03-14T12:00:00Z'),
              },
              {
                sessionId: 3,
                gameSlug: 'around-the-clock',
                gameName: 'Around the Clock',
                status: 'completed',
                playerCount: 2,
                currentRound: 8,
                winnerName: 'Alice',
                lastActivityAt: new Date('2026-03-14T12:00:00Z'),
              },
            ],
          },
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: mockRefetch,
        };
      }
      return emptyQueryResult;
    });

    render(<StatsScreen />);

    expect(screen.getByText('STATS')).toBeTruthy();
    expect(screen.getByText('Games Played')).toBeTruthy();
    expect(screen.getByText('Recent Matches')).toBeTruthy();
    expect(screen.getAllByText('Cricket').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Cricket Setup session')).toBeTruthy();
    expect(screen.getByLabelText('X01 In Progress session')).toBeTruthy();
    expect(screen.getByLabelText('Around the Clock Completed session')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Cricket Setup session'));
    fireEvent.press(screen.getByLabelText('X01 In Progress session'));
    fireEvent.press(screen.getByLabelText('Around the Clock Completed session'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/game/cricket');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/game/x01/play?sessionId=2');
    expect(mockPush).toHaveBeenNthCalledWith(3, '/game/around-the-clock/results?sessionId=3');

    const list = screen.getByTestId('tabs-stats-flatlist');
    list.props.onRefresh();

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });

    // Time filter pills are rendered
    expect(screen.getByLabelText('Filter by All time')).toBeTruthy();
    expect(screen.getByLabelText('Filter by Last 30d')).toBeTruthy();
    expect(screen.getByLabelText('Filter by Last 7d')).toBeTruthy();

    // Game filter pills are rendered (from mocked GAMES)
    expect(screen.getByLabelText('Show all games')).toBeTruthy();
    expect(screen.getByLabelText('Filter by 501 / 301')).toBeTruthy();

    // Pressing a time filter does not throw
    fireEvent.press(screen.getByLabelText('Filter by Last 7d'));
    fireEvent.press(screen.getByLabelText('Filter by All time'));

    // Pressing a game filter does not throw
    fireEvent.press(screen.getByLabelText('Filter by 501 / 301'));
    fireEvent.press(screen.getByLabelText('Show all games'));
  });

  it('renders personal bests when data is available', () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'history') {
        return { data: { quickStats: { gamesPlayed: 0, completedCount: 0, winRate: 0, inProgressSessions: 0, abandonedSessions: 0 }, sessions: [] }, isLoading: false, isRefetching: false, error: null, refetch: mockRefetch };
      }
      if (opts.queryKey[1] === 'personal-bests') {
        return {
          data: [
            { gameSlug: 'cricket', gameName: 'Cricket', gamesPlayed: 3, gamesWon: 1, bestScore: 45, avgThreeDartAvg: 22.5 },
          ],
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: mockRefetch,
        };
      }
      return emptyQueryResult;
    });

    render(<StatsScreen />);

    expect(screen.getByText('Personal Bests')).toBeTruthy();
    expect(screen.getByText('3 played · 1 won')).toBeTruthy();
    expect(screen.getByText('Best: 45')).toBeTruthy();
    expect(screen.getByText('Avg: 22.5')).toBeTruthy();
  });

  it('alerts when query returns an error', async () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'history') {
        return { data: { quickStats: undefined, sessions: [] }, isLoading: false, isRefetching: false, error: new Error('Boom'), refetch: mockRefetch };
      }
      return emptyQueryResult;
    });

    render(<StatsScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Stats Error', 'Boom');
    });
  });
});
