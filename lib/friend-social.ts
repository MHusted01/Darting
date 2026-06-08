import type { SupabaseClient } from '@supabase/supabase-js';
import { mapMutualClub, mapRecentGameRow, type RawRecentGameRow } from '@/lib/social-stats';
import type { ActivityPage, FriendActivityItem, MutualClub, RecentGame } from '@/types/social';

export async function getPlayerRecentGames(
  supabase: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<RecentGame[]> {
  const { data, error } = await supabase.rpc('get_player_recent_games', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawRecentGameRow[]).map(mapRecentGameRow);
}

export async function getMutualClubs(
  supabase: SupabaseClient,
  userId: string,
): Promise<MutualClub[]> {
  const { data, error } = await supabase.rpc('get_mutual_clubs', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; name: string }[]).map(mapMutualClub);
}

type RawActivityRow = {
  session_id: string;
  author_id: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
  game_slug: string;
  completed_at: string;
  is_winner: boolean;
  three_dart_avg: number | null;
};

function mapActivityRow(row: RawActivityRow): FriendActivityItem {
  return {
    sessionId: row.session_id,
    author: {
      id: row.author_id,
      firstName: row.author_first_name,
      lastName: row.author_last_name,
      username: row.author_username,
      avatarUrl: row.author_avatar_url,
    },
    gameSlug: row.game_slug,
    completedAt: row.completed_at,
    isWinner: row.is_winner,
    threeDartAvg: row.three_dart_avg,
  };
}

interface ActivityCursorPayload {
  completedAt: string;
  sessionId: string;
  authorId: string;
}

function encodeActivityCursor(c: ActivityCursorPayload): string {
  return btoa(JSON.stringify(c));
}

function decodeActivityCursor(s: string): ActivityCursorPayload {
  try {
    const parsed = JSON.parse(atob(s));
    if (
      !parsed ||
      typeof parsed.completedAt !== 'string' ||
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.authorId !== 'string'
    ) {
      throw new Error('Invalid activity cursor format');
    }
    return parsed as ActivityCursorPayload;
  } catch {
    throw new Error('Invalid activity cursor format');
  }
}

export async function getFriendsActivityPage(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
): Promise<ActivityPage> {
  const params: Record<string, unknown> = { p_limit: limit + 1 };
  if (cursor) {
    const { completedAt, sessionId, authorId } = decodeActivityCursor(cursor);
    params.p_cursor_completed_at = completedAt;
    params.p_cursor_id = sessionId;
    params.p_cursor_author_id = authorId;
  }

  const { data, error } = await supabase.rpc('get_friends_activity', params);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawActivityRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(mapActivityRow),
    nextCursor:
      hasMore && last
        ? encodeActivityCursor({ completedAt: last.completed_at, sessionId: last.session_id, authorId: last.author_id })
        : null,
  };
}
