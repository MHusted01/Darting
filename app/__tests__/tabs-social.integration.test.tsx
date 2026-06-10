import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import SocialScreen from '@/app/(protected)/(tabs)/social';

const mockPush: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

const mockClubsQuery: { isLoading: boolean; data: object[] | undefined; refetch: jest.Mock<any> } = {
  isLoading: false,
  data: [],
  refetch: jest.fn(),
};
const mockFriendsQuery: { isLoading: boolean; data: object[] | undefined; refetch: jest.Mock<any> } = {
  isLoading: false,
  data: [],
  refetch: jest.fn(),
};

jest.mock('@/hooks/useClubs', () => ({
  useMyClubs: () => mockClubsQuery,
}));

jest.mock('@/hooks/useFriends', () => ({
  useFriends: () => mockFriendsQuery,
  useRemoveFriend: () => ({ mutate: jest.fn() }),
}));

jest.mock('@/providers/PresenceProvider', () => ({
  usePresenceContext: () => ({ presenceMap: {} }),
}));

jest.mock('@/hooks/useTournament', () => ({
  useMyActiveTournaments: () => ({ data: [], refetch: jest.fn() }),
}));

jest.mock('@/components/social/FriendRequestsSection', () => ({
  FriendRequestsSection: () => null,
}));
jest.mock('@/components/social/ChallengeInvitesSection', () => ({
  ChallengeInvitesSection: () => null,
}));
jest.mock('@/components/social/OutgoingChallengesSection', () => {
  const { Text } = jest.requireActual('react-native') as { Text: typeof import('react-native').Text };
  return {
    OutgoingChallengesSection: () => <Text>OutgoingChallengesStub</Text>,
  };
});
jest.mock('@/components/social/FriendActivitySection', () => ({
  FriendActivitySection: () => null,
}));
jest.mock('@/components/social/FriendSearchModal', () => ({
  FriendSearchModal: () => null,
}));
jest.mock('@/components/social/CreateClubModal', () => ({
  CreateClubModal: () => null,
}));
jest.mock('@/components/social/ClubSearchModal', () => ({
  ClubSearchModal: () => null,
}));

const mockRefetchQueries: jest.Mock<any> = jest.fn();
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query') as object;
  return {
    ...actual,
    useQueryClient: () => ({ refetchQueries: mockRefetchQueries }),
  };
});

describe('Social tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClubsQuery.isLoading = false;
    mockClubsQuery.data = [];
    mockFriendsQuery.isLoading = false;
    mockFriendsQuery.data = [];
  });

  it('shows skeleton placeholders while clubs and friends load', () => {
    mockClubsQuery.isLoading = true;
    mockClubsQuery.data = undefined;
    mockFriendsQuery.isLoading = true;
    mockFriendsQuery.data = undefined;

    render(<SocialScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(2);
  });

  it('pull-to-refresh refetches every social section', () => {
    const { RefreshControl } = jest.requireActual('react-native') as typeof import('react-native');
    render(<SocialScreen />);
    const refreshControl = screen.UNSAFE_getByType(RefreshControl);
    refreshControl.props.onRefresh();
    expect(mockClubsQuery.refetch).toHaveBeenCalled();
    expect(mockFriendsQuery.refetch).toHaveBeenCalled();
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['friends-activity'] });
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['friend-requests'] });
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['challenges'] });
  });

  it('mounts the outgoing challenges section', () => {
    render(<SocialScreen />);
    expect(screen.getByText('OutgoingChallengesStub')).toBeTruthy();
  });

  it('shows empty states with CTAs once loading finishes', () => {
    render(<SocialScreen />);
    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
    expect(screen.getByText(/not in any clubs yet/i)).toBeTruthy();
    expect(screen.getByText(/No friends yet/i)).toBeTruthy();
    expect(screen.getByText('Browse clubs')).toBeTruthy();
    expect(screen.getByText('Add friends')).toBeTruthy();
  });
});
