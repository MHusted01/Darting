import React from 'react';
import { describe, expect, it, afterEach, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TabsLayout from '@/app/(protected)/(tabs)/_layout';
import StatsScreen from '@/app/(protected)/(tabs)/stats';
import {
  getOverallThreeDartAvg,
  getPerGameKPIs,
  getTrendData,
} from '@/lib/stats';

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

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

jest.mock('@/lib/history', () => ({
  getHistoryData: jest.fn(),
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: 'test-clerk-user' }),
}));

jest.mock('@/lib/player', () => ({
  getUserPlayerId: jest.fn(),
}));

jest.mock('@/lib/stats', () => ({
  getPersonalBests: jest.fn(),
  getOverallThreeDartAvg: jest.fn(),
  getSegmentAccuracy: jest.fn(),
  getCheckoutStats: jest.fn(),
  getPerGameKPIs: jest.fn(),
  getAggregatedStats: jest.fn(),
  getTrendData: jest.fn(),
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
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
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

  const playerIdResult = {
    data: 5,
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
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
      return emptyQueryResult;
    });

    render(<StatsScreen />);

    expect(screen.getByText('Loading stats...')).toBeTruthy();
  });

  it('renders stats data and routes by status', async () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
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

    // Game filter pills are rendered (from mocked GAMES) — x01 splits into variant chips
    expect(screen.getByLabelText('Show all games')).toBeTruthy();
    expect(screen.getByLabelText('Filter by 501')).toBeTruthy();
    expect(screen.getByLabelText('Filter by 301')).toBeTruthy();
    expect(screen.queryByLabelText('Filter by 501 / 301')).toBeNull();

    // Pressing a time filter does not throw
    fireEvent.press(screen.getByLabelText('Filter by Last 7d'));
    fireEvent.press(screen.getByLabelText('Filter by All time'));

    // Pressing a game filter does not throw
    fireEvent.press(screen.getByLabelText('Filter by 501'));
    fireEvent.press(screen.getByLabelText('Show all games'));
  });

  it('passes the x01 variant to stats queries when a variant chip is active', async () => {
    const capturedOpts: any[] = [];
    mockUseQuery.mockImplementation((opts: any) => {
      capturedOpts.push(opts);
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
      if (opts.queryKey[0] === 'history') {
        return { data: { quickStats: { gamesPlayed: 0, completedCount: 0, winRate: 0, inProgressSessions: 0, abandonedSessions: 0 }, sessions: [] }, isLoading: false, isRefetching: false, error: null, refetch: mockRefetch };
      }
      return emptyQueryResult;
    });

    render(<StatsScreen />);
    fireEvent.press(screen.getByLabelText('Filter by 301'));

    const lastOf = (key: string) => capturedOpts.filter((o) => o.queryKey[1] === key).at(-1);

    await lastOf('kpi')?.queryFn();
    expect(getPerGameKPIs).toHaveBeenLastCalledWith(5, 'x01', expect.objectContaining({ variant: 301 }));

    await lastOf('trend')?.queryFn();
    expect(getTrendData).toHaveBeenLastCalledWith(5, expect.any(Number), expect.objectContaining({ slug: 'x01', variant: 301 }));

    expect(lastOf('kpi')?.queryKey).toContain(301);
    expect(lastOf('trend')?.queryKey).toContain(301);
  });

  it('defaults the hero average to 501-only with a combined toggle', async () => {
    const capturedOpts: any[] = [];
    mockUseQuery.mockImplementation((opts: any) => {
      capturedOpts.push(opts);
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
      if (opts.queryKey[0] === 'history') {
        return { data: { quickStats: { gamesPlayed: 0, completedCount: 0, winRate: 0, inProgressSessions: 0, abandonedSessions: 0 }, sessions: [] }, isLoading: false, isRefetching: false, error: null, refetch: mockRefetch };
      }
      return emptyQueryResult;
    });

    render(<StatsScreen />);

    expect(screen.getByText('3-Dart Average')).toBeTruthy();
    const lastAvg = () => capturedOpts.filter((o) => o.queryKey[1] === 'three-dart-avg').at(-1);
    expect(lastAvg()?.queryKey).toContain(501);
    await lastAvg()?.queryFn();
    expect(getOverallThreeDartAvg).toHaveBeenLastCalledWith(5, 501);

    fireEvent.press(screen.getByLabelText('Show combined 501 and 301 average'));

    expect(screen.getByText('3-Dart Average')).toBeTruthy();
    expect(lastAvg()?.queryKey).toContain('all');
    await lastAvg()?.queryFn();
    expect(getOverallThreeDartAvg).toHaveBeenLastCalledWith(5, 'all');
  });

  it('filters the history list by x01 variant', () => {
    const sessionBase = {
      status: 'completed',
      playerCount: 2,
      currentRound: 5,
      winnerName: null,
      lastActivityAt: new Date('2026-03-14T12:00:00Z'),
    };
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
      if (opts.queryKey[0] === 'history') {
        return {
          data: {
            quickStats: { gamesPlayed: 2, completedCount: 2, winRate: 100, inProgressSessions: 0, abandonedSessions: 0 },
            sessions: [
              { ...sessionBase, sessionId: 10, gameSlug: 'x01', startingScore: 501, gameName: '501 / 301' },
              { ...sessionBase, sessionId: 11, gameSlug: 'x01', startingScore: 301, gameName: '501 / 301' },
              { ...sessionBase, sessionId: 12, gameSlug: 'cricket', startingScore: null, gameName: 'Cricket' },
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
    expect(screen.getAllByLabelText('501 / 301 Completed session')).toHaveLength(2);

    fireEvent.press(screen.getByLabelText('Filter by 501'));
    expect(screen.getAllByLabelText('501 / 301 Completed session')).toHaveLength(1);
    expect(screen.queryByLabelText('Cricket Completed session')).toBeNull();
  });

  it('renders per-variant personal best rows', () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
      if (opts.queryKey[0] === 'history') {
        return { data: { quickStats: { gamesPlayed: 0, completedCount: 0, winRate: 0, inProgressSessions: 0, abandonedSessions: 0 }, sessions: [] }, isLoading: false, isRefetching: false, error: null, refetch: mockRefetch };
      }
      if (opts.queryKey[1] === 'personal-bests') {
        return {
          data: [
            { gameSlug: 'x01', variant: 501, gameName: '501', gamesPlayed: 4, gamesWon: 2, bestScore: null, avgThreeDartAvg: 55.2 },
            { gameSlug: 'x01', variant: 301, gameName: '301', gamesPlayed: 2, gamesWon: 1, bestScore: null, avgThreeDartAvg: 48.1 },
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

    expect(screen.getAllByText('501').length).toBeGreaterThan(0);
    expect(screen.getAllByText('301').length).toBeGreaterThan(0);
    expect(screen.getByText('4 played · 2 won')).toBeTruthy();
    expect(screen.getByText('2 played · 1 won')).toBeTruthy();
    expect(screen.getByText('Avg: 55.2')).toBeTruthy();
    expect(screen.getByText('Avg: 48.1')).toBeTruthy();
  });

  it('renders personal bests when data is available', () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
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

  it('personal-bests query has enabled:false when playerId is null', () => {
    const capturedOpts: any[] = [];
    mockUseQuery.mockImplementation((opts: any) => {
      capturedOpts.push(opts);
      if (opts.queryKey[0] === 'user-player-id') {
        return { data: null, isLoading: false, isRefetching: false, error: null, refetch: mockRefetch };
      }
      return emptyQueryResult;
    });

    render(<StatsScreen />);

    const bests = capturedOpts.find((o) => o.queryKey[1] === 'personal-bests');
    const avg = capturedOpts.find((o) => o.queryKey[1] === 'three-dart-avg');
    expect(bests?.enabled).toBe(false);
    expect(avg?.enabled).toBe(false);
  });

  it('alerts when query returns an error', async () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey[0] === 'user-player-id') return playerIdResult;
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
