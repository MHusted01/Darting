import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ClubFeed } from '@/components/clubfeed/ClubFeed';

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: 'user-123' }),
}));

let mockFeed: {
  data: { pages: { items: object[] }[] } | undefined;
  isLoading: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: jest.Mock;
  refetch: jest.Mock;
};

jest.mock('@/hooks/useClubFeed', () => ({
  useClubFeed: () => mockFeed,
  useDeletePost: () => ({ mutate: jest.fn() }),
  useSetReaction: () => ({ mutate: jest.fn() }),
}));

jest.mock('@/components/clubfeed/PostCard', () => ({
  PostCard: () => null,
}));

jest.mock('@/components/clubfeed/PostComposer', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    PostComposer: ({ visible }: { visible: boolean }) =>
      visible ? <Text>ComposerOpen</Text> : null,
  };
});

describe('ClubFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeed = {
      data: { pages: [{ items: [] }] },
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
    };
  });

  it('shows skeletons while loading', () => {
    mockFeed.isLoading = true;
    mockFeed.data = undefined;
    render(<ClubFeed clubId="club-1" isAdmin={false} />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(2);
  });

  it('shows an EmptyState with a create-post CTA when the feed is empty', () => {
    render(<ClubFeed clubId="club-1" isAdmin={false} />);
    expect(screen.getByText('No posts yet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('empty-state-cta'));
    expect(screen.getByText('ComposerOpen')).toBeTruthy();
  });
});
