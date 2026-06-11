import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { X01PlayPanel } from '@/components/games/X01PlayPanel';
import type { LoadedPlayer } from '@/hooks/usePlaySession';

const player: LoadedPlayer = {
  id: 1,
  playerId: 1,
  playerOrder: 0,
  userId: null,
  name: 'Alex',
  avatarColor: '#b8f0bc',
  currentScore: 461,
  gameState: { remaining: 40 },
  isWinner: false,
};

const baseProps = {
  players: [player],
  currentPlayerId: 1,
  localX01State: { remaining: 40 },
  turnDarts: [],
  isProcessing: false,
  onDartThrown: jest.fn(),
};

describe('X01PlayPanel — missed target chip', () => {
  it('does not render the chip when showMissedTarget is false', () => {
    render(<X01PlayPanel {...baseProps} showMissedTarget={false} />);
    expect(screen.queryByText('Tag your checkout target')).toBeNull();
  });

  it('renders the chip and reports the selected double when active', () => {
    const onSelect = jest.fn();
    const onDismiss = jest.fn();
    render(
      <X01PlayPanel
        {...baseProps}
        showMissedTarget
        onSelectMissedTarget={onSelect}
        onDismissMissedTarget={onDismiss}
      />,
    );

    expect(screen.getByText('Tag your checkout target')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Aimed at double 20'));
    expect(onSelect).toHaveBeenCalledWith(20);

    fireEvent.press(screen.getByLabelText('Aimed at bull'));
    expect(onSelect).toHaveBeenCalledWith(25);

    fireEvent.press(screen.getByLabelText('Dismiss missed target prompt'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
