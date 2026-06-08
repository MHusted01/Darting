import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CheckoutAnalysis from '@/components/CheckoutAnalysis';
import type { CheckoutSummary } from '@/lib/stats';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const emptySummary: CheckoutSummary = {
  totalAttempts: 0,
  totalSuccesses: 0,
  overallRate: 0,
  byDouble: {},
  bestDoubles: [],
  worstDoubles: [],
};

const richSummary: CheckoutSummary = {
  totalAttempts: 30,
  totalSuccesses: 12,
  overallRate: 0.4,
  byDouble: {
    '20': { attempts: 10, successes: 8 },
    '16': { attempts: 10, successes: 3 },
    '10': { attempts: 10, successes: 4 },
  },
  bestDoubles: [
    { segment: 20, attempts: 10, successes: 8, rate: 0.8 },
    { segment: 10, attempts: 10, successes: 4, rate: 0.4 },
  ],
  worstDoubles: [
    { segment: 16, attempts: 10, successes: 3, rate: 0.3 },
    { segment: 10, attempts: 10, successes: 4, rate: 0.4 },
  ],
};

describe('CheckoutAnalysis', () => {
  it('renders empty state when summary is null', () => {
    render(<CheckoutAnalysis summary={null} />);
    expect(screen.getByText('No checkout data yet')).toBeTruthy();
  });

  it('renders empty state when no attempts recorded', () => {
    render(<CheckoutAnalysis summary={emptySummary} />);
    expect(screen.getByText('No checkout data yet')).toBeTruthy();
  });

  it('renders overall checkout rate', () => {
    const summary: CheckoutSummary = { ...richSummary, totalSuccesses: 9, totalAttempts: 20, overallRate: 0.45 };
    render(<CheckoutAnalysis summary={summary} />);
    expect(screen.getByText('45%')).toBeTruthy();
  });

  it('renders best doubles', () => {
    render(<CheckoutAnalysis summary={richSummary} />);
    expect(screen.getByText('D20')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
  });

  it('renders worst doubles', () => {
    render(<CheckoutAnalysis summary={richSummary} />);
    expect(screen.getByText('D16')).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
  });

  it('renders practice doubles link when worst doubles are present', () => {
    render(<CheckoutAnalysis summary={richSummary} />);
    expect(screen.getByText('Practice doubles')).toBeTruthy();
  });

  it('navigates to drill screen when practice doubles link is tapped', () => {
    render(<CheckoutAnalysis summary={richSummary} />);
    fireEvent.press(screen.getByText('Practice doubles'));
    expect(mockPush).toHaveBeenCalledWith('/drill/practice-doubles');
  });

  it('does not render practice doubles link when no worst doubles', () => {
    const noWorst: CheckoutSummary = { ...richSummary, worstDoubles: [] };
    render(<CheckoutAnalysis summary={noWorst} />);
    expect(screen.queryByText('Practice doubles')).toBeNull();
  });
});
