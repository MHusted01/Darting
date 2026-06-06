import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GameSetup from '@/app/(protected)/game/[slug]/index';

const mockPush: jest.Mock<any> = jest.fn();

let mockSlug = 'x01';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slug: mockSlug }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@clerk/expo', () => ({
  useUser: () => ({
    isLoaded: true,
    user: { id: 'clerk-test-user', firstName: 'Marcus', username: null },
  }),
}));

jest.mock('@/lib/player', () => ({
  getOrCreateUserPlayer: jest.fn(),
}));

jest.mock('@/db/client', () => ({
  db: {
    insert: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('@/components/PlayerManager', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View, Text, Pressable } = jest.requireActual('react-native') as typeof import('react-native');

  const getNextAvatarColor = (index: number) => ['#6366f1', '#ec4899'][index] ?? '#6366f1';

  function PlayerManager({
    players,
    onAddPlayer,
    onRemovePlayer,
    lockedPlayerId,
  }: {
    players: { id: number; name: string; avatarColor: string }[];
    onAddPlayer: (name: string) => void;
    onRemovePlayer: (id: number) => void;
    minPlayers: number;
    lockedPlayerId?: number;
  }) {
    return React.createElement(
      View,
      null,
      React.createElement(
        Pressable,
        {
          onPress: () => onAddPlayer('Alice'),
          accessibilityRole: 'button',
          accessibilityLabel: 'Add player',
        },
        React.createElement(Text, null, 'Add Player'),
      ),
      ...players.map((p) =>
        React.createElement(
          View,
          { key: p.id },
          React.createElement(Text, null, p.name),
          p.id !== lockedPlayerId
            ? React.createElement(
                Pressable,
                {
                  onPress: () => onRemovePlayer(p.id),
                  accessibilityRole: 'button',
                  accessibilityLabel: `Remove ${p.name}`,
                },
                React.createElement(Text, null, 'Remove'),
              )
            : null,
        ),
      ),
    );
  }

  return { PlayerManager, getNextAvatarColor };
});

describe('GameSetup — X01', () => {
  let dbMock: { insert: jest.Mock<any>; transaction: jest.Mock<any> };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSlug = 'x01';
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const playerMock = require('@/lib/player') as { getOrCreateUserPlayer: jest.Mock<any> };
    playerMock.getOrCreateUserPlayer.mockResolvedValue({ id: 99, name: 'Marcus', avatarColor: '#6366f1' });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    dbMock = (require('@/db/client') as { db: typeof dbMock }).db;

    const playerResult = [{ id: 1, name: 'Alice', avatarColor: '#6366f1' }];
    dbMock.insert.mockReturnValue({
      values: jest.fn().mockReturnValue(
        Object.assign(Promise.resolve(playerResult), {
          returning: jest.fn().mockResolvedValue(playerResult as never),
        }),
      ),
    });

    dbMock.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      let insertCallCount = 0;
      const tx = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockImplementation(() => {
            insertCallCount++;
            const isFirst = insertCallCount === 1;
            const resolveWith = isFirst ? [{ id: 42 }] : [];
            const p = Promise.resolve(resolveWith) as Promise<unknown[]> & {
              returning: () => Promise<unknown[]>;
            };
            p.returning = () => Promise.resolve(resolveWith);
            return p;
          }),
        }),
      };
      return fn(tx);
    });
  });

  it('renders the game title and description', () => {
    render(<GameSetup />);

    expect(screen.getByText('501 / 301')).toBeTruthy();
    expect(screen.getByText(/Count down from 501 or 301/)).toBeTruthy();
  });

  it('renders 501 and 301 score selector', () => {
    render(<GameSetup />);

    expect(screen.getByLabelText('501 starting score')).toBeTruthy();
    expect(screen.getByLabelText('301 starting score')).toBeTruthy();
  });

  it('Start Game button is disabled while user is loading', () => {
    render(<GameSetup />);

    const startBtn = screen.getByLabelText('Start game');
    expect(startBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('Start Game button enables after signed-in user auto-loads', async () => {
    render(<GameSetup />);

    await waitFor(() => {
      const startBtn = screen.getByLabelText('Start game');
      expect(startBtn.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  it('signed-in user is auto-added as first player', async () => {
    render(<GameSetup />);

    await waitFor(() => {
      expect(screen.getByText('Marcus')).toBeTruthy();
    });
  });

  it('Start Game button enables after adding a guest player too', async () => {
    render(<GameSetup />);

    await waitFor(() => {
      expect(screen.getByText('Marcus')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add player'));

    await waitFor(() => {
      const startBtn = screen.getByLabelText('Start game');
      expect(startBtn.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  it('starting game navigates to play screen with session id', async () => {
    render(<GameSetup />);

    await waitFor(() => {
      const startBtn = screen.getByLabelText('Start game');
      expect(startBtn.props.accessibilityState?.disabled).toBeFalsy();
    });

    fireEvent.press(screen.getByLabelText('Start game'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/game/x01/play?sessionId=42');
    });
  });

  it('pressing 301 selector switches starting score', () => {
    render(<GameSetup />);

    const btn301 = screen.getByLabelText('301 starting score');
    expect(btn301.props.accessibilityState?.selected).toBeFalsy();

    fireEvent.press(btn301);

    expect(btn301.props.accessibilityState?.selected).toBe(true);
  });

  it('shows fallback for unknown slug', () => {
    mockSlug = 'unknown-game';
    render(<GameSetup />);

    expect(screen.getByText('Game not found')).toBeTruthy();
  });

  it('locked player (signed-in user) has no remove button', async () => {
    render(<GameSetup />);

    await waitFor(() => {
      expect(screen.getByText('Marcus')).toBeTruthy();
    });

    expect(screen.queryByLabelText('Remove Marcus')).toBeNull();
  });
});
