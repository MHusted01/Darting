import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import GameCategoryScreen from '@/app/(protected)/games/[category]';

const mockBack = jest.fn();
const mockPush: jest.Mock<any> = jest.fn();

let mockCategory: string | undefined = 'Classic';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ category: mockCategory }),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('@/components/GameCard', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    GameCard: ({ game, onPress }: { game: { name: string }; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { onPress, accessibilityRole: 'button', accessibilityLabel: game.name },
        React.createElement(Text, null, game.name),
      ),
  };
});

describe('GameCategory Screen Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header label for a valid category', () => {
    mockCategory = 'Classic';
    render(<GameCategoryScreen />);

    expect(screen.getByText('Real Game')).toBeTruthy();
  });

  it('renders games for a valid category', () => {
    mockCategory = 'Classic';
    render(<GameCategoryScreen />);

    expect(screen.getByText('Cricket')).toBeTruthy();
  });

  it('renders fallback label for an invalid category', () => {
    mockCategory = 'invalid-category';
    render(<GameCategoryScreen />);

    expect(screen.getByText('Games')).toBeTruthy();
  });

  it('renders empty list for an invalid category', () => {
    mockCategory = 'invalid-category';
    render(<GameCategoryScreen />);

    expect(screen.queryByLabelText('Cricket')).toBeNull();
  });

  it('back button navigates back', () => {
    mockCategory = 'Classic';
    render(<GameCategoryScreen />);

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockBack).toHaveBeenCalled();
  });
});
