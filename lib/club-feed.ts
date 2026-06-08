import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeCursor, encodeCursor, mapCommentRow, mapPostRow, type RawCommentRow, type RawPostRow } from '@/lib/feed';
import type { ClubPost, ClubPostComment, CommentsPage, FeedPage, ReactionType, ReactorUser } from '@/types/social';

export async function getClubFeedPage(
  supabase: SupabaseClient,
  clubId: string,
  cursor: string | null,
  limit: number,
): Promise<FeedPage> {
  const params: Record<string, unknown> = { p_club_id: clubId, p_limit: limit + 1 };
  if (cursor) {
    const { createdAt, id } = decodeCursor(cursor);
    params.p_cursor_created_at = createdAt;
    params.p_cursor_id = id;
  }

  const { data, error } = await supabase.rpc('get_club_feed', params);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawPostRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(mapPostRow),
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
  };
}

export async function createPost(
  supabase: SupabaseClient,
  params: { clubId: string; authorId: string; body: string; gameSessionId: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('club_posts')
    .insert({
      club_id: params.clubId,
      author_id: params.authorId,
      body: params.body,
      game_session_id: params.gameSessionId,
    });

  if (error) throw new Error(error.message);
}

export async function deletePost(supabase: SupabaseClient, postId: string): Promise<void> {
  const { error } = await supabase.from('club_posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
}

export async function getPostComments(
  supabase: SupabaseClient,
  postId: string,
  cursor: string | null,
  limit: number,
): Promise<CommentsPage> {
  const params: Record<string, unknown> = { p_post_id: postId, p_limit: limit + 1 };
  if (cursor) {
    const { createdAt, id } = decodeCursor(cursor);
    params.p_cursor_created_at = createdAt;
    params.p_cursor_id = id;
  }

  const { data, error } = await supabase.rpc('get_post_comments', params);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawCommentRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(mapCommentRow),
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
  };
}

export async function getLatestPostComments(
  supabase: SupabaseClient,
  postId: string,
  limit = 2,
): Promise<ClubPostComment[]> {
  const { data, error } = await supabase.rpc('get_latest_post_comments', {
    p_post_id: postId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawCommentRow[]).map(mapCommentRow).reverse();
}

export async function addComment(
  supabase: SupabaseClient,
  params: { postId: string; authorId: string; body: string; parentCommentId?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('club_post_comments')
    .insert({
      post_id: params.postId,
      author_id: params.authorId,
      body: params.body,
      parent_comment_id: params.parentCommentId ?? null,
    });

  if (error) throw new Error(error.message);
}

export async function deleteComment(supabase: SupabaseClient, commentId: string): Promise<void> {
  const { error } = await supabase.from('club_post_comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
}

export async function setReaction(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  type: ReactionType,
): Promise<void> {
  const { error } = await supabase
    .from('club_post_reactions')
    .insert({ post_id: postId, user_id: userId, type });
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function setCommentReaction(
  supabase: SupabaseClient,
  commentId: string,
  userId: string,
  type: ReactionType,
): Promise<void> {
  const { error } = await supabase
    .from('club_comment_reactions')
    .insert({ comment_id: commentId, user_id: userId, type });
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function removeCommentReaction(
  supabase: SupabaseClient,
  commentId: string,
  userId: string,
  type: ReactionType,
): Promise<void> {
  const { error } = await supabase
    .from('club_comment_reactions')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .eq('type', type);
  if (error) throw new Error(error.message);
}

type RawReactorRow = { user_id: string; first_name: string | null; last_name: string | null; username: string | null; type: string };

function mapReactorRow(row: RawReactorRow): ReactorUser {
  return {
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    reactionType: row.type as ReactionType,
  };
}

export async function getPostReactions(supabase: SupabaseClient, postId: string): Promise<ReactorUser[]> {
  const { data, error } = await supabase.rpc('get_post_reactions', { p_post_id: postId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawReactorRow[]).map(mapReactorRow);
}

export async function getCommentReactions(supabase: SupabaseClient, commentId: string): Promise<ReactorUser[]> {
  const { data, error } = await supabase.rpc('get_comment_reactions', { p_comment_id: commentId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawReactorRow[]).map(mapReactorRow);
}

export async function removeReaction(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  type: ReactionType,
): Promise<void> {
  const { error } = await supabase
    .from('club_post_reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('type', type);
  if (error) throw new Error(error.message);
}
