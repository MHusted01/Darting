import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Target } from 'lucide-react-native';
import { GameCard } from '@/components/GameCard';
import type { DartGame } from '@/constants/games';

jest.mock('@/lib/haptics', () => ({
  impact: jest.fn(),
  notify: jest.fn(),
  selection: jest.fn(),
}));

const haptics = jest.requireMock('@/lib/haptics') as { impact: jest.Mock };

const game = {
  slug: 'x01',
  name: '501',
  description: 'Classic countdown game',
  category: 'Classic',
  playerCount: '1-8',
  difficulty: 'Easy',
  icon: Target,
} as unknown as DartGame;

describe('GameCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders name and description', () => {
    render(<GameCard game={game} onPress={jest.fn()} />);
    expect(screen.getByText('501')).toBeTruthy();
    expect(screen.getByText('Classic countdown game')).toBeTruthy();
  });

  it('fires onPress and a light impact haptic', () => {
    const onPress = jest.fn();
    render(<GameCard game={game} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('501 - Classic countdown game'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(haptics.impact).toHaveBeenCalledWith('light');
  });
});
