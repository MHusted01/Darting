import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PlayScreen from '@/app/(protected)/game/[slug]/play';
import type { X01PlayerState } from '@/lib/games/x01';

const mockReplace: jest.Mock<any> = jest.fn();
const mockHandleX01DartThrown: jest.Mock<any> = jest.fn();
const mockHandleQuit: jest.Mock<any> = jest.fn();

let mockSlug = 'x01';
let mockSessionId = '1';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slug: mockSlug, sessionId: mockSessionId }),
  useRouter: () => ({ replace: mockReplace }),
}));

const basePlayer = {
  id: 1,
  playerId: 1,
  playerOrder: 0,
  name: 'Alice',
  avatarColor: '#6366f1',
  currentScore: 0,
  gameState: { remaining: 501 } satisfies X01PlayerState,
  isWinner: false,
};

const baseGameState = {
  sessionId: 1,
  gameSlug: 'x01',
  currentRound: 1,
  currentPlayerIndex: 0,
  config: { startingScore: 501 },
  players: [basePlayer],
};

let mockHookReturn: HookReturn;

interface HookReturn {
  gameState: any;
  currentPlayer: any;
  loadError: string | null;
  turnDarts: any[];
  isProcessing: boolean;
  isAroundTheClock: boolean;
  isCricket: boolean;
  isX01: boolean;
  localTarget: number;
  localCricketState: null;
  localX01State: X01PlayerState | null;
  handleATCDartThrown: jest.Mock<any>;
  handleCricketDartThrown: jest.Mock<any>;
  handleX01DartThrown: jest.Mock<any>;
  handleQuit: jest.Mock<any>;
}

function buildHookReturn(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    gameState: baseGameState as any,
    currentPlayer: basePlayer as any,
    loadError: null as string | null,
    turnDarts: [] as any[],
    isProcessing: false,
    isAroundTheClock: false,
    isCricket: false,
    isX01: true,
    localTarget: 1,
    localCricketState: null,
    localX01State: { remaining: 501 } satisfies X01PlayerState,
    handleATCDartThrown: jest.fn(),
    handleCricketDartThrown: jest.fn(),
    handleX01DartThrown: mockHandleX01DartThrown,
    handleQuit: mockHandleQuit,
    ...overrides,
  };
}

jest.mock('@/hooks/usePlaySession', () => ({
  usePlaySession: () => mockHookReturn,
}));

// Mock game panel components so tests aren't affected by their internals
jest.mock('@/components/games/AroundTheClockPlayPanel', () => ({
  AroundTheClockPlayPanel: () => null,
}));

jest.mock('@/components/games/CricketPlayPanel', () => ({
  CricketPlayPanel: () => null,
}));

jest.mock('@/components/games/X01PlayPanel', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View, Text, Pressable } = jest.requireActual('react-native') as typeof import('react-native');

  return {
    X01PlayPanel: ({
      localX01State,
      onDartThrown,
    }: {
      localX01State: { remaining: number };
      onDartThrown: (dart: { segment: number; multiplier: number }) => void;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(
          Text,
          { testID: 'x01-remaining' },
          String(localX01State.remaining),
        ),
        React.createElement(
          Pressable,
          {
            onPress: () => onDartThrown({ segment: 20, multiplier: 2 }),
            accessibilityRole: 'button',
            accessibilityLabel: 'Throw double 20',
          },
          React.createElement(Text, null, 'D20'),
        ),
      ),
  };
});

describe('PlayScreen — X01', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSlug = 'x01';
    mockSessionId = '1';
    mockHookReturn = buildHookReturn();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('renders loading state when game state is null', () => {
    mockHookReturn = buildHookReturn({ gameState: null, currentPlayer: null });
    render(<PlayScreen />);

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders error state with back button', () => {
    mockHookReturn = buildHookReturn({
      loadError: 'This session is no longer active.',
      gameState: null,
      currentPlayer: null,
    });
    render(<PlayScreen />);

    expect(screen.getByText('This session is no longer active.')).toBeTruthy();
    expect(screen.getByLabelText('Go back to games')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Go back to games'));
    expect(mockReplace).toHaveBeenCalledWith('/(protected)/(tabs)');
  });

  it('renders current player name and round number', () => {
    render(<PlayScreen />);

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Round 1')).toBeTruthy();
  });

  it('renders X01 panel with remaining score', () => {
    render(<PlayScreen />);

    expect(screen.getByTestId('x01-remaining').props.children).toBe('501');
  });

  it('forwards dart throws to handleX01DartThrown', async () => {
    render(<PlayScreen />);

    fireEvent.press(screen.getByLabelText('Throw double 20'));

    await waitFor(() => {
      expect(mockHandleX01DartThrown).toHaveBeenCalledWith({
        segment: 20,
        multiplier: 2,
      });
    });
  });

  it('quit button calls handleQuit', () => {
    render(<PlayScreen />);

    fireEvent.press(screen.getByLabelText('Quit game'));

    expect(mockHandleQuit).toHaveBeenCalled();
  });

  it('does not render X01 panel for non-x01 game', () => {
    mockHookReturn = buildHookReturn({ isX01: false, localX01State: null });
    render(<PlayScreen />);

    expect(screen.queryByTestId('x01-remaining')).toBeNull();
  });
});
