import type { SupabaseClient } from '@supabase/supabase-js';
import type { Friend, FriendRequest, UserProfile, PresenceMap } from '@/types/social';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  requester: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null };
  addressee: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null };
};

export function mapFriendRow(
  row: FriendshipRow,
  currentUserId: string,
  threeDartAvgs?: Map<string, number>,
): Friend {
  const other = row.requester_id === currentUserId ? row.addressee : row.requester;
  return {
    friendshipId: row.id,
    id:           other.id,
    firstName:    other.first_name,
    lastName:     other.last_name,
    avatarUrl:    other.avatar_url,
    username:     other.username,
    status:       'offline',
    threeDartAvg: threeDartAvgs?.get(other.id) ?? null,
  };
}

export function mergePresence(friends: Friend[], presenceMap: PresenceMap): Friend[] {
  return friends.map((f) => ({
    ...f,
    status: presenceMap[f.id] ?? 'offline',
  }));
}

function mapProfileRow(row: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
}): UserProfile {
  return {
    id:        row.id,
    firstName: row.first_name,
    lastName:  row.last_name,
    avatarUrl: row.avatar_url,
    username:  row.username,
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function searchUsers(
  supabase: SupabaseClient,
  query: string,
  currentUserId: string,
): Promise<UserProfile[]> {
  type ProfileRow = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null };
  let data: ProfileRow[] | null;
  let error: { message: string } | null;

  const atIndex = query.indexOf('@');
  const looksLikeEmail = atIndex > 0 && query.includes('.', atIndex);
  const looksLikeHandle = query.startsWith('@') && !looksLikeEmail;

  if (looksLikeHandle) {
    const handle = query.slice(1);
    if (handle.length < 2) return [];
    ({ data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, avatar_url, username')
      .ilike('username', `${handle}%`)
      .limit(20));
  } else if (looksLikeEmail) {
    ({ data, error } = await supabase.rpc('search_users_by_email', { search_email: query }));
  } else {
    const safe = query.replace(/[(),]/g, '');
    ({ data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, avatar_url, username')
      .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,username.ilike.%${safe}%`)
      .limit(20));
  }

  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => row.id !== currentUserId)
    .map(mapProfileRow);
}

export async function sendFriendRequest(
  supabase: SupabaseClient,
  requesterId: string,
  addresseeId: string,
): Promise<{ alreadyRequested: boolean }> {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId });

  if (error) {
    if (error.code === '23505') return { alreadyRequested: true };
    throw new Error(error.message);
  }
  return { alreadyRequested: false };
}

export async function getPendingRequests(
  supabase: SupabaseClient,
  userId: string,
): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, requester:requester_id(id, first_name, last_name, avatar_url, username), created_at')
    .eq('addressee_id', userId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);

  type PendingRow = {
    id: string;
    requester_id: string;
    requester: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null };
    created_at: string;
  };
  return ((data ?? []) as unknown as PendingRow[]).map((row) => ({
    id:        row.id,
    requester: mapProfileRow(row.requester),
    createdAt: row.created_at,
  }));
}

export async function getFriendThreeDartAvgs(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_friends_three_dart_avgs');

  if (error) return new Map();

  type AvgRow = { friend_id: string; avg_three_dart_avg: number | null };
  const avgs = new Map<string, number>();
  for (const row of (data ?? []) as AvgRow[]) {
    if (row.avg_three_dart_avg != null) avgs.set(row.friend_id, row.avg_three_dart_avg);
  }
  return avgs;
}

export async function getFriends(
  supabase: SupabaseClient,
  userId: string,
): Promise<Friend[]> {
  const [{ data, error }, threeDartAvgs] = await Promise.all([
    supabase
      .from('friendships')
      .select(`
        id,
        requester_id,
        addressee_id,
        requester:requester_id(id, first_name, last_name, avatar_url, username),
        addressee:addressee_id(id, first_name, last_name, avatar_url, username)
      `)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted'),
    getFriendThreeDartAvgs(supabase).catch(() => new Map<string, number>()),
  ]);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FriendshipRow[]).map((row) =>
    mapFriendRow(row, userId, threeDartAvgs),
  );
}

export async function acceptFriendRequest(
  supabase: SupabaseClient,
  friendshipId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .eq('addressee_id', userId);

  if (error) throw new Error(error.message);
}

export async function declineFriendRequest(
  supabase: SupabaseClient,
  friendshipId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .eq('addressee_id', userId);

  if (error) throw new Error(error.message);
}

export async function removeFriend(
  supabase: SupabaseClient,
  friendshipId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) throw new Error(error.message);
}
