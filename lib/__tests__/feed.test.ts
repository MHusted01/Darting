import { describe, expect, it } from '@jest/globals';
import { decodeCursor, encodeCursor, mapCommentRow, mapPostRow } from '@/lib/feed';
import type { RawCommentRow, RawPostRow } from '@/lib/feed';

const POST_ID = 'post-uuid-1';
const CLUB_ID = 'club-uuid-1';
const AUTHOR_ID = 'author-1';

function makeRawPost(overrides: Partial<RawPostRow> = {}): RawPostRow {
  return {
    id: POST_ID,
    club_id: CLUB_ID,
    author_id: AUTHOR_ID,
    body: 'Good game everyone',
    game_session_id: null,
    created_at: '2026-06-08T10:00:00Z',
    author_first_name: 'Marcus',
    author_last_name: 'H',
    author_username: 'marcus_h',
    author_avatar_url: '#ba1a1a',
    thumbs_up_count: 2,
    thumbs_down_count: 0,
    bullseye_count: 1,
    fire_count: 0,
    my_reactions: [],
    comment_count: 3,
    game_slug: null,
    game_three_dart_avg: null,
    ...overrides,
  };
}

function makeRawComment(overrides = {}): RawCommentRow {
  return {
    id: 'comment-1',
    post_id: POST_ID,
    author_id: AUTHOR_ID,
    body: 'Great throw!',
    created_at: '2026-06-08T10:05:00Z',
    author_first_name: 'Marcus',
    author_last_name: 'H',
    author_username: 'marcus_h',
    author_avatar_url: '#ba1a1a',
    ...overrides,
  };
}

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a cursor object', () => {
    const cursor = { createdAt: '2026-06-08T10:00:00Z', id: POST_ID };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('produces a non-empty string', () => {
    expect(encodeCursor({ createdAt: '2026-01-01T00:00:00Z', id: 'abc' }).length).toBeGreaterThan(0);
  });
});

describe('mapPostRow', () => {
  it('maps snake_case fields to camelCase', () => {
    const post = mapPostRow(makeRawPost());
    expect(post.id).toBe(POST_ID);
    expect(post.clubId).toBe(CLUB_ID);
    expect(post.body).toBe('Good game everyone');
    expect(post.createdAt).toBe('2026-06-08T10:00:00Z');
    expect(post.commentCount).toBe(3);
  });

  it('maps author fields correctly', () => {
    const post = mapPostRow(makeRawPost());
    expect(post.author.id).toBe(AUTHOR_ID);
    expect(post.author.firstName).toBe('Marcus');
    expect(post.author.username).toBe('marcus_h');
    expect(post.author.avatarUrl).toBe('#ba1a1a');
  });

  it('maps aggregated reactions', () => {
    const post = mapPostRow(makeRawPost({ thumbs_up_count: 2, thumbs_down_count: 0, bullseye_count: 1, fire_count: 0, my_reactions: ['bullseye', 'fire'] }));
    expect(post.reactions.thumbs_up).toBe(2);
    expect(post.reactions.bullseye).toBe(1);
    expect(post.reactions.fire).toBe(0);
    expect(post.reactions.myReactions).toContain('bullseye');
    expect(post.reactions.myReactions).toContain('fire');
  });

  it('sets gameCard to null when no game attached', () => {
    const post = mapPostRow(makeRawPost());
    expect(post.gameCard).toBeNull();
  });

  it('maps gameCard when game is attached', () => {
    const post = mapPostRow(makeRawPost({
      game_slug: 'x01-501',
      game_three_dart_avg: 55.2,
    }));
    expect(post.gameCard).not.toBeNull();
    expect(post.gameCard!.gameSlug).toBe('x01-501');
    expect(post.gameCard!.threeDartAvg).toBe(55.2);
  });
});

describe('mapCommentRow', () => {
  it('maps fields correctly', () => {
    const comment = mapCommentRow(makeRawComment());
    expect(comment.id).toBe('comment-1');
    expect(comment.postId).toBe(POST_ID);
    expect(comment.body).toBe('Great throw!');
    expect(comment.author.firstName).toBe('Marcus');
  });
});
