import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CommentsModal } from '@/components/clubfeed/CommentsModal';
import type { ClubPostComment } from '@/types/social';

jest.mock('@/components/clubfeed/ReactionsModal', () => ({
  ReactionsModal: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockAddCommentMutate: jest.Mock<any> = jest.fn();
let mockComments: ClubPostComment[] = [];

jest.mock('@/hooks/useClubFeed', () => ({
  usePostComments: () => ({
    data: { pages: [{ items: mockComments }] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  }),
  useAddComment: () => ({ mutate: mockAddCommentMutate, isPending: false }),
  useDeleteComment: () => ({ mutate: jest.fn() }),
  useSetCommentReaction: () => ({ mutate: jest.fn() }),
}));

jest.mock('@/hooks/useClubs', () => ({
  useClubMembers: () => ({ data: [] }),
}));

function comment(
  id: string,
  body: string,
  parentCommentId: string | null,
  createdAt: string,
): ClubPostComment {
  return {
    id,
    postId: 'post-1',
    parentCommentId,
    body,
    createdAt,
    author: { id: `author-${id}`, firstName: 'A', lastName: 'B', username: `user${id}` },
    reactions: { thumbs_up: 0, thumbs_down: 0, bullseye: 0, fire: 0, myReactions: [] },
  } as unknown as ClubPostComment;
}

function renderModal() {
  return render(
    <CommentsModal
      visible
      postId="post-1"
      clubId="club-1"
      currentUserId="user-123"
      isAdmin={false}
      onClose={jest.fn()}
    />,
  );
}

describe('CommentsModal reply threads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('collapses to the latest reply preview when a parent has multiple replies', () => {
    mockComments = [
      comment('p1', 'Parent comment', null, '2026-06-01T10:00:00Z'),
      comment('r1', 'Oldest reply', 'p1', '2026-06-01T11:00:00Z'),
      comment('r2', 'Middle reply', 'p1', '2026-06-01T12:00:00Z'),
      comment('r3', 'Latest reply', 'p1', '2026-06-01T13:00:00Z'),
    ];
    renderModal();

    expect(screen.getByText('Parent comment')).toBeTruthy();
    expect(screen.getByText('Latest reply')).toBeTruthy();
    expect(screen.queryByText('Oldest reply')).toBeNull();
    expect(screen.queryByText('Middle reply')).toBeNull();
    expect(screen.getByLabelText('Show replies')).toBeTruthy();
  });

  it('expands a single thread on press and can hide it again', () => {
    mockComments = [
      comment('p1', 'Parent one', null, '2026-06-01T10:00:00Z'),
      comment('r1', 'P1 old reply', 'p1', '2026-06-01T11:00:00Z'),
      comment('r2', 'P1 new reply', 'p1', '2026-06-01T12:00:00Z'),
      comment('p2', 'Parent two', null, '2026-06-01T10:30:00Z'),
      comment('r3', 'P2 old reply', 'p2', '2026-06-01T11:30:00Z'),
      comment('r4', 'P2 new reply', 'p2', '2026-06-01T12:30:00Z'),
    ];
    renderModal();

    fireEvent.press(screen.getAllByLabelText('Show replies')[0]);

    expect(screen.getByText('P1 old reply')).toBeTruthy();
    expect(screen.getByText('P1 new reply')).toBeTruthy();
    expect(screen.queryByText('P2 old reply')).toBeNull();
    expect(screen.getByLabelText('Hide replies')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Hide replies'));
    expect(screen.queryByText('P1 old reply')).toBeNull();
    expect(screen.getByText('P1 new reply')).toBeTruthy();
  });

  it('shows a single reply without any toggle', () => {
    mockComments = [
      comment('p1', 'Parent comment', null, '2026-06-01T10:00:00Z'),
      comment('r1', 'Only reply', 'p1', '2026-06-01T11:00:00Z'),
    ];
    renderModal();

    expect(screen.getByText('Only reply')).toBeTruthy();
    expect(screen.queryByLabelText('Show replies')).toBeNull();
    expect(screen.queryByLabelText('Hide replies')).toBeNull();
  });
});

describe('CommentsModal submit error preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComments = [];
    jest.spyOn(Alert, 'alert').mockImplementation(() => null);
  });

  it('restores the typed text when addComment fails', () => {
    mockAddCommentMutate.mockImplementation(
      (_vars: unknown, opts?: { onError?: (err: Error) => void }) => {
        opts?.onError?.(new Error('network down'));
      },
    );
    renderModal();

    const input = screen.getByLabelText('Write a comment');
    fireEvent.changeText(input, 'My long comment');
    fireEvent.press(screen.getByLabelText('Send'));

    expect(mockAddCommentMutate).toHaveBeenCalled();
    expect(input.props.value).toBe('My long comment');
  });

  it('clears the typed text when addComment succeeds', () => {
    mockAddCommentMutate.mockImplementation(
      (_vars: unknown, opts?: { onSuccess?: () => void }) => {
        opts?.onSuccess?.();
      },
    );
    renderModal();

    const input = screen.getByLabelText('Write a comment');
    fireEvent.changeText(input, 'My comment');
    fireEvent.press(screen.getByLabelText('Send'));

    expect(input.props.value).toBe('');
  });

  it('uses comment-oriented empty copy', () => {
    mockComments = [];
    renderModal();
    expect(screen.getByText('Be the first to comment.')).toBeTruthy();
  });
});
