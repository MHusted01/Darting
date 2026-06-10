import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OutgoingChallengesSection } from '@/components/social/OutgoingChallengesSection';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockGateEnabled = true;
jest.mock('@/lib/subscription', () => ({
  useFeatureGate: () => mockGateEnabled,
}));

const mockCancelMutate = jest.fn();
let mockCancelPending = false;
let mockOutgoingData: object[] | undefined = [];

jest.mock('@/hooks/useChallenges', () => ({
  useOutgoingChallenges: () => ({ data: mockOutgoingData }),
  useCancelChallenge: () => ({ mutate: mockCancelMutate, isPending: mockCancelPending }),
}));

const challenges = [
  { id: 'out-1', gameSlug: '501', challengerName: 'Me', challengeeName: 'Alice' },
  { id: 'out-2', gameSlug: '501', challengerName: 'Me', challengeeName: 'Bob' },
];

describe('OutgoingChallengesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGateEnabled = true;
    mockCancelPending = false;
    mockOutgoingData = challenges;
  });

  it('renders a row per outgoing pending challenge with the opponent name', () => {
    render(<OutgoingChallengesSection />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Sent Challenges')).toBeTruthy();
  });

  it('renders nothing when there are no outgoing challenges', () => {
    mockOutgoingData = [];
    render(<OutgoingChallengesSection />);
    expect(screen.queryByText('Sent Challenges')).toBeNull();
  });

  it('renders nothing when the realtime gate is off', () => {
    mockGateEnabled = false;
    render(<OutgoingChallengesSection />);
    expect(screen.queryByText('Sent Challenges')).toBeNull();
  });

  it('cancelling calls the mutation with the challenge id', () => {
    render(<OutgoingChallengesSection />);
    fireEvent.press(screen.getByLabelText('Cancel challenge to Alice'));
    expect(mockCancelMutate).toHaveBeenCalledWith('out-1', expect.anything());
  });

  it('shows pending state only on the cancelled row', () => {
    render(<OutgoingChallengesSection />);
    fireEvent.press(screen.getByLabelText('Cancel challenge to Alice'));

    expect(screen.getByTestId('cancel-pending-out-1')).toBeTruthy();
    expect(screen.queryByTestId('cancel-pending-out-2')).toBeNull();
  });

  it('navigates to the lobby when a row is opened', () => {
    render(<OutgoingChallengesSection />);
    fireEvent.press(screen.getByLabelText('View challenge to Alice'));
    expect(mockPush).toHaveBeenCalledWith('/challenge/out-1');
  });
});
