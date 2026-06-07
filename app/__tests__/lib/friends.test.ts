import { describe, it, expect, jest } from '@jest/globals';

import {
  mapFriendRow,
  mergePresence,
  searchUsers,
  sendFriendRequest,
  getPendingRequests,
  getFriends,
  acceptFriendRequest,
  declineFriendRequest,
} from '@/lib/friends';
import type { PresenceMap } from '@/types/social';

// ─── Fake Supabase builder ────────────────────────────────────────────────────

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const self = () => chain;
  chain.from     = jest.fn(self) as jest.Mock;
  chain.select   = jest.fn(self) as jest.Mock;
  chain.insert   = jest.fn(self) as jest.Mock;
  chain.update   = jest.fn(self) as jest.Mock;
  chain.delete   = jest.fn(self) as jest.Mock;
  chain.eq       = jest.fn(self) as jest.Mock;
  chain.neq      = jest.fn(self) as jest.Mock;
  chain.or       = jest.fn(self) as jest.Mock;
  chain.ilike    = jest.fn(self) as jest.Mock;
  chain.limit    = jest.fn(self) as jest.Mock;
  chain.single   = jest.fn(() => Promise.resolve(result)) as jest.Mock;
  chain.maybeSingle = jest.fn(() => Promise.resolve(result)) as jest.Mock;
  // terminal — awaiting the chain resolves
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

function makeSupabase(result: { data: unknown; error: unknown }) {
  const chain = makeChain(result);
  return {
    from: jest.fn(() => chain) as jest.Mock,
    rpc:  jest.fn(() => Promise.resolve(result)) as jest.Mock,
    _chain: chain,
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ME = 'user_me';
const OTHER = 'user_other';

const profileRow = {
  id: OTHER,
  first_name: 'Jane',
  last_name:  'Doe',
  avatar_url: null,
  username:   'janedoe',
};

const friendshipRow = {
  id:           'fs_1',
  requester_id: ME,
  addressee_id: OTHER,
  status:       'accepted',
  requester:    { id: ME,    first_name: 'Me',   last_name: 'User', avatar_url: null, username: 'meuser' },
  addressee:    { id: OTHER, first_name: 'Jane', last_name: 'Doe',  avatar_url: null, username: 'janedoe' },
};

const pendingRow = {
  id:           'fs_2',
  requester_id: OTHER,
  addressee_id: ME,
  status:       'pending',
  requester:    { id: OTHER, first_name: 'Jane', last_name: 'Doe', avatar_url: null, username: 'janedoe' },
  addressee:    { id: ME,    first_name: 'Me',   last_name: 'User', avatar_url: null, username: 'meuser' },
};

// ─── mapFriendRow ─────────────────────────────────────────────────────────────

describe('mapFriendRow', () => {
  it('resolves the other party when caller is requester', () => {
    const result = mapFriendRow(friendshipRow, ME);
    expect(result.id).toBe(OTHER);
    expect(result.firstName).toBe('Jane');
    expect(result.friendshipId).toBe('fs_1');
  });

  it('resolves the other party when caller is addressee', () => {
    const row = {
      id:           'fs_1',
      requester_id: OTHER,
      addressee_id: ME,
      requester:    { id: OTHER, first_name: 'Jane', last_name: 'Doe',  avatar_url: null, username: 'janedoe' },
      addressee:    { id: ME,    first_name: 'Me',   last_name: 'User', avatar_url: null, username: 'meuser' },
    };
    const result = mapFriendRow(row, ME);
    expect(result.id).toBe(OTHER);
  });

  it('includes status offline by default (no presence)', () => {
    const result = mapFriendRow(friendshipRow, ME);
    expect(result.status).toBe('offline');
  });
});

// ─── mergePresence ────────────────────────────────────────────────────────────

describe('mergePresence', () => {
  it('overlays presence status onto matched friends', () => {
    const friends = [mapFriendRow(friendshipRow, ME)];
    const presenceMap: PresenceMap = { [OTHER]: 'online' };
    const merged = mergePresence(friends, presenceMap);
    expect(merged[0].status).toBe('online');
  });

  it('leaves unmatched friends as offline', () => {
    const friends = [mapFriendRow(friendshipRow, ME)];
    const merged = mergePresence(friends, {});
    expect(merged[0].status).toBe('offline');
  });

  it('returns a new array (does not mutate input)', () => {
    const friends = [mapFriendRow(friendshipRow, ME)];
    const original = friends[0].status;
    mergePresence(friends, { [OTHER]: 'in_match' });
    expect(friends[0].status).toBe(original);
  });
});

// ─── searchUsers ──────────────────────────────────────────────────────────────

describe('searchUsers', () => {
  it('queries user_profiles with or-filter for name search', async () => {
    const sb = makeSupabase({ data: [profileRow], error: null });
    const results = await searchUsers(sb as never, 'jane', ME);
    expect(sb.from).toHaveBeenCalledWith('user_profiles');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(OTHER);
  });

  it('excludes the current user from results', async () => {
    const selfRow = { ...profileRow, id: ME };
    const sb = makeSupabase({ data: [selfRow, profileRow], error: null });
    const results = await searchUsers(sb as never, 'jane', ME);
    expect(results.every((r) => r.id !== ME)).toBe(true);
  });

  it('uses search_users_by_email rpc when query contains @ and a dot (email)', async () => {
    const sb = makeSupabase({ data: [profileRow], error: null });
    await searchUsers(sb as never, 'jane@example.com', ME);
    expect(sb.rpc).toHaveBeenCalledWith('search_users_by_email', { search_email: 'jane@example.com' });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it('searches user_profiles by username prefix when query starts with @', async () => {
    const sb = makeSupabase({ data: [profileRow], error: null });
    const results = await searchUsers(sb as never, '@janedoe', ME);
    expect(sb.from).toHaveBeenCalledWith('user_profiles');
    expect(sb._chain.ilike).toHaveBeenCalledWith('username', 'janedoe%');
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(results[0].username).toBe('janedoe');
  });

  it('includes username in plain name search results', async () => {
    const sb = makeSupabase({ data: [profileRow], error: null });
    const results = await searchUsers(sb as never, 'jane', ME);
    expect(results[0].username).toBe('janedoe');
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'network error' } });
    await expect(searchUsers(sb as never, 'jane', ME)).rejects.toThrow('network error');
  });
});

// ─── sendFriendRequest ────────────────────────────────────────────────────────

describe('sendFriendRequest', () => {
  it('inserts a friendship row', async () => {
    const sb = makeSupabase({ data: { id: 'fs_new' }, error: null });
    const result = await sendFriendRequest(sb as never, ME, OTHER);
    expect(sb.from).toHaveBeenCalledWith('friendships');
    expect(result.alreadyRequested).toBe(false);
  });

  it('returns alreadyRequested=true on unique violation (code 23505)', async () => {
    const sb = makeSupabase({ data: null, error: { code: '23505', message: 'duplicate' } });
    const result = await sendFriendRequest(sb as never, ME, OTHER);
    expect(result.alreadyRequested).toBe(true);
  });

  it('throws on unexpected supabase error', async () => {
    const sb = makeSupabase({ data: null, error: { code: 'UNKNOWN', message: 'fail' } });
    await expect(sendFriendRequest(sb as never, ME, OTHER)).rejects.toThrow('fail');
  });
});

// ─── getPendingRequests ───────────────────────────────────────────────────────

describe('getPendingRequests', () => {
  it('returns pending requests addressed to the user', async () => {
    const sb = makeSupabase({ data: [pendingRow], error: null });
    const results = await getPendingRequests(sb as never, ME);
    expect(sb.from).toHaveBeenCalledWith('friendships');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('fs_2');
    expect(results[0].requester.id).toBe(OTHER);
  });

  it('returns empty array when no pending requests', async () => {
    const sb = makeSupabase({ data: [], error: null });
    const results = await getPendingRequests(sb as never, ME);
    expect(results).toHaveLength(0);
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'rls error' } });
    await expect(getPendingRequests(sb as never, ME)).rejects.toThrow('rls error');
  });
});

// ─── getFriends ───────────────────────────────────────────────────────────────

describe('getFriends', () => {
  it('resolves other party when caller is requester', async () => {
    const row = { ...friendshipRow, requester_id: ME, addressee_id: OTHER };
    const sb = makeSupabase({ data: [row], error: null });
    const results = await getFriends(sb as never, ME);
    expect(results[0].id).toBe(OTHER);
  });

  it('resolves other party when caller is addressee', async () => {
    const row = {
      id:           'fs_1',
      requester_id: OTHER,
      addressee_id: ME,
      requester:    { id: OTHER, first_name: 'Jane', last_name: 'Doe',  avatar_url: null, username: 'janedoe' },
      addressee:    { id: ME,    first_name: 'Me',   last_name: 'User', avatar_url: null, username: 'meuser' },
    };
    const sb = makeSupabase({ data: [row], error: null });
    const results = await getFriends(sb as never, ME);
    expect(results[0].id).toBe(OTHER);
  });

  it('returns empty array when no friends', async () => {
    const sb = makeSupabase({ data: [], error: null });
    const results = await getFriends(sb as never, ME);
    expect(results).toHaveLength(0);
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'query failed' } });
    await expect(getFriends(sb as never, ME)).rejects.toThrow('query failed');
  });
});

// ─── acceptFriendRequest ──────────────────────────────────────────────────────

describe('acceptFriendRequest', () => {
  it('updates the friendship status to accepted scoped to addressee', async () => {
    const sb = makeSupabase({ data: null, error: null });
    await acceptFriendRequest(sb as never, 'fs_2', ME);
    expect(sb.from).toHaveBeenCalledWith('friendships');
    expect(sb._chain.eq).toHaveBeenCalledWith('addressee_id', ME);
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'update failed' } });
    await expect(acceptFriendRequest(sb as never, 'fs_2', ME)).rejects.toThrow('update failed');
  });
});

// ─── declineFriendRequest ─────────────────────────────────────────────────────

describe('declineFriendRequest', () => {
  it('deletes the friendship row scoped to addressee', async () => {
    const sb = makeSupabase({ data: null, error: null });
    await declineFriendRequest(sb as never, 'fs_2', ME);
    expect(sb.from).toHaveBeenCalledWith('friendships');
    expect(sb._chain.eq).toHaveBeenCalledWith('addressee_id', ME);
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'delete failed' } });
    await expect(declineFriendRequest(sb as never, 'fs_2', ME)).rejects.toThrow('delete failed');
  });
});
