import type { ClubPost, ClubPostComment, ReactionType } from '@/types/social';

export interface RawPostRow {
  id: string;
  club_id: string;
  author_id: string;
  body: string;
  game_session_id: string | null;
  created_at: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
  thumbs_up_count: number;
  bullseye_count: number;
  fire_count: number;
  thumbs_down_count: number;
  my_reactions: string[];
  comment_count: number;
  game_slug: string | null;
  game_three_dart_avg: number | null;
}

export interface RawCommentRow {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  author_id: string;
  body: string;
  created_at: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
  thumbs_up_count?: number;
  bullseye_count?: number;
  fire_count?: number;
  thumbs_down_count?: number;
  my_reactions?: string[];
}

interface CursorPayload {
  createdAt: string;
  id: string;
}

export function encodeCursor(c: CursorPayload): string {
  return btoa(JSON.stringify(c));
}

export function decodeCursor(s: string): CursorPayload {
  return JSON.parse(atob(s)) as CursorPayload;
}

export function mapPostRow(row: RawPostRow): ClubPost {
  return {
    id: row.id,
    clubId: row.club_id,
    body: row.body,
    createdAt: row.created_at,
    commentCount: row.comment_count,
    author: {
      id: row.author_id,
      firstName: row.author_first_name,
      lastName: row.author_last_name,
      username: row.author_username,
      avatarUrl: row.author_avatar_url,
    },
    reactions: {
      thumbs_up: row.thumbs_up_count,
      thumbs_down: row.thumbs_down_count,
      bullseye: row.bullseye_count,
      fire: row.fire_count,
      myReactions: (row.my_reactions ?? []) as ReactionType[],
    },
    gameCard:
      row.game_slug != null
        ? { gameSlug: row.game_slug, threeDartAvg: row.game_three_dart_avg }
        : null,
  };
}

export function mapCommentRow(row: RawCommentRow): ClubPostComment {
  return {
    id: row.id,
    postId: row.post_id,
    parentCommentId: row.parent_comment_id ?? null,
    body: row.body,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      firstName: row.author_first_name,
      lastName: row.author_last_name,
      username: row.author_username,
      avatarUrl: row.author_avatar_url,
    },
    reactions: {
      thumbs_up: row.thumbs_up_count ?? 0,
      thumbs_down: row.thumbs_down_count ?? 0,
      bullseye: row.bullseye_count ?? 0,
      fire: row.fire_count ?? 0,
      myReactions: (row.my_reactions ?? []) as ReactionType[],
    },
  };
}
