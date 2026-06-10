import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ChallengeInvitesSection } from '@/components/social/ChallengeInvitesSection';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/subscription', () => ({
  useFeatureGate: () => true,
}));

const mockDeclineMutate = jest.fn();
let mockDeclinePending = false;
const mockIncoming = {
  data: [
    { id: 'ch-1', gameSlug: '501', challengerName: 'Alice', challengeeName: 'Me' },
    { id: 'ch-2', gameSlug: '501', challengerName: 'Bob', challengeeName: 'Me' },
  ],
};

jest.mock('@/hooks/useChallenges', () => ({
  useIncomingChallenges: () => mockIncoming,
  useDeclineChallenge: () => ({ mutate: mockDeclineMutate, isPending: mockDeclinePending }),
}));

describe('ChallengeInvitesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeclinePending = false;
  });

  it('renders a row per incoming challenge', () => {
    render(<ChallengeInvitesSection />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('declining calls the mutation with the challenge id', () => {
    render(<ChallengeInvitesSection />);
    fireEvent.press(screen.getByLabelText('Decline challenge from Alice'));
    expect(mockDeclineMutate).toHaveBeenCalledWith('ch-1', expect.anything());
  });

  it('shows pending state only on the declined row', () => {
    render(<ChallengeInvitesSection />);
    fireEvent.press(screen.getByLabelText('Decline challenge from Alice'));

    expect(screen.getByTestId('decline-pending-ch-1')).toBeTruthy();
    expect(screen.queryByTestId('decline-pending-ch-2')).toBeNull();
  });
});
