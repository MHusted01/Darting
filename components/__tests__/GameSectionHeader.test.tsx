import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { GameSectionHeader } from '@/components/GameSectionHeader';

describe('GameSectionHeader', () => {
  it('renders the provided title', () => {
    render(<GameSectionHeader title="History" />);
    expect(screen.getByText('History')).toBeTruthy();
  });
});
