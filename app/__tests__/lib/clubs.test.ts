import { describe, it, expect, jest } from '@jest/globals';

import {
  mapClubRow,
  mapMemberRow,
  mapLeaderboardRow,
  createClub,
  searchClubs,
  getMyClubs,
  joinClub,
  leaveClub,
  getClubMembers,
  getClubLeaderboard,
  inviteMember,
} from '@/lib/clubs';

// ─── Fake Supabase builder ────────────────────────────────────────────────────

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: any = {};  
  const self = () => chain;
  chain.select  = jest.fn(self) as jest.Mock;
  chain.insert  = jest.fn(self) as jest.Mock;
  chain.update  = jest.fn(self) as jest.Mock;
  chain.delete  = jest.fn(self) as jest.Mock;
  chain.eq      = jest.fn(self) as jest.Mock;
  chain.ilike   = jest.fn(self) as jest.Mock;
  chain.order   = jest.fn(self) as jest.Mock;
  chain.single  = jest.fn(() => Promise.resolve(result)) as jest.Mock;
  chain.then = (resolve: (v: unknown) => unknown): Promise<unknown> => Promise.resolve(result).then(resolve);
  return chain;
}

function makeSupabase(results: { data: unknown; error: unknown }[]) {
  let callCount = 0;
  const supabase = {
    from: jest.fn(() => {
      const result = results[callCount] ?? results[results.length - 1];
      callCount++;
      return makeChain(result);
    }) as jest.Mock,
    rpc: jest.fn(((_name: string, _args?: unknown) => {
      const result = results[callCount] ?? results[results.length - 1];
      callCount++;
      return Promise.resolve(result);
    }) as jest.Mock) as jest.Mock,
  };
  return supabase;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ME = 'user_me';
const OTHER = 'user_other';
const CLUB_ID = 'club_uuid_1';

const clubRow = {
  id:          CLUB_ID,
  name:        'Test Club',
  description: 'A test club',
  created_by:  ME,
  created_at:  '2026-06-07T12:00:00Z',
  updated_at:  '2026-06-07T12:00:00Z',
};

const membershipRow = {
  id:       'mem_1',
  club_id:  CLUB_ID,
  user_id:  ME,
  role:     'admin',
  joined_at: '2026-06-07T12:00:00Z',
  club:     clubRow,
};

const memberRow = {
  id:       'mem_2',
  club_id:  CLUB_ID,
  user_id:  OTHER,
  role:     'member' as const,
  joined_at: '2026-06-07T12:30:00Z',
  user:     { id: OTHER, first_name: 'Jane', last_name: 'Doe', avatar_url: null, username: 'janedoe' },
};

const leaderboardRow = {
  club_id:           CLUB_ID,
  user_id:           ME,
  first_name:        'Me',
  last_name:         'User',
  avatar_url:        null,
  games_played:      5,
  avg_three_dart_avg: 54.2,
};

// ─── mapClubRow ───────────────────────────────────────────────────────────────

describe('mapClubRow', () => {
  it('maps snake_case fields to camelCase', () => {
    const result = mapClubRow(clubRow, 'admin');
    expect(result.id).toBe(CLUB_ID);
    expect(result.name).toBe('Test Club');
    expect(result.createdBy).toBe(ME);
    expect(result.role).toBe('admin');
  });
});

// ─── mapMemberRow ─────────────────────────────────────────────────────────────

describe('mapMemberRow', () => {
  it('maps membership + nested user to ClubMember', () => {
    const result = mapMemberRow(memberRow);
    expect(result.membershipId).toBe('mem_2');
    expect(result.id).toBe(OTHER);
    expect(result.firstName).toBe('Jane');
    expect(result.role).toBe('member');
    expect(result.username).toBe('janedoe');
  });
});

// ─── mapLeaderboardRow ────────────────────────────────────────────────────────

describe('mapLeaderboardRow', () => {
  it('maps leaderboard row to ClubLeaderboardRow', () => {
    const result = mapLeaderboardRow(leaderboardRow);
    expect(result.userId).toBe(ME);
    expect(result.gamesPlayed).toBe(5);
    expect(result.avgThreeDartAvg).toBeCloseTo(54.2);
  });

  it('handles null avg_three_dart_avg', () => {
    const result = mapLeaderboardRow({ ...leaderboardRow, avg_three_dart_avg: null });
    expect(result.avgThreeDartAvg).toBeNull();
  });
});

// ─── createClub ───────────────────────────────────────────────────────────────

describe('createClub', () => {
  it('inserts club then inserts admin membership', async () => {
    const sb = makeSupabase([
      { data: clubRow, error: null },
      { data: { id: 'mem_1' }, error: null },
    ]);
    const result = await createClub(sb as never, ME, 'Test Club', 'desc');
    expect(sb.from).toHaveBeenCalledTimes(2);
    expect(result.id).toBe(CLUB_ID);
    expect(result.role).toBe('admin');
  });

  it('throws when club insert fails', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'insert failed' } }]);
    await expect(createClub(sb as never, ME, 'Test Club')).rejects.toThrow('insert failed');
  });

  it('throws when membership insert fails', async () => {
    const sb = makeSupabase([
      { data: clubRow, error: null },
      { data: null, error: { message: 'membership failed' } },
    ]);
    await expect(createClub(sb as never, ME, 'Test Club')).rejects.toThrow('membership failed');
  });
});

// ─── searchClubs ──────────────────────────────────────────────────────────────

describe('searchClubs', () => {
  it('queries clubs with ilike on name', async () => {
    const sb = makeSupabase([{ data: [clubRow], error: null }]);
    const results = await searchClubs(sb as never, 'test');
    expect(sb.from).toHaveBeenCalledWith('clubs');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Test Club');
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'search failed' } }]);
    await expect(searchClubs(sb as never, 'test')).rejects.toThrow('search failed');
  });
});

// ─── getMyClubs ───────────────────────────────────────────────────────────────

describe('getMyClubs', () => {
  it('returns clubs with role from memberships', async () => {
    const sb = makeSupabase([{ data: [membershipRow], error: null }]);
    const results = await getMyClubs(sb as never, ME);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(CLUB_ID);
    expect(results[0].role).toBe('admin');
  });

  it('returns empty array when not a member of any club', async () => {
    const sb = makeSupabase([{ data: [], error: null }]);
    const results = await getMyClubs(sb as never, ME);
    expect(results).toHaveLength(0);
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'rls error' } }]);
    await expect(getMyClubs(sb as never, ME)).rejects.toThrow('rls error');
  });
});

// ─── joinClub ─────────────────────────────────────────────────────────────────

describe('joinClub', () => {
  it('inserts a member membership', async () => {
    const sb = makeSupabase([{ data: { id: 'mem_new' }, error: null }]);
    const result = await joinClub(sb as never, CLUB_ID, ME);
    expect(sb.from).toHaveBeenCalledWith('club_memberships');
    expect(result.alreadyMember).toBe(false);
  });

  it('returns alreadyMember=true on unique violation', async () => {
    const sb = makeSupabase([{ data: null, error: { code: '23505', message: 'dup' } }]);
    const result = await joinClub(sb as never, CLUB_ID, ME);
    expect(result.alreadyMember).toBe(true);
  });

  it('throws on unexpected supabase error', async () => {
    const sb = makeSupabase([{ data: null, error: { code: 'UNKNOWN', message: 'fail' } }]);
    await expect(joinClub(sb as never, CLUB_ID, ME)).rejects.toThrow('fail');
  });
});

// ─── leaveClub ────────────────────────────────────────────────────────────────

describe('leaveClub', () => {
  it('deletes the membership row', async () => {
    const sb = makeSupabase([{ data: null, error: null }]);
    await leaveClub(sb as never, CLUB_ID, ME);
    expect(sb.from).toHaveBeenCalledWith('club_memberships');
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'delete failed' } }]);
    await expect(leaveClub(sb as never, CLUB_ID, ME)).rejects.toThrow('delete failed');
  });
});

// ─── getClubMembers ───────────────────────────────────────────────────────────

describe('getClubMembers', () => {
  it('returns club members with user profiles', async () => {
    const sb = makeSupabase([{ data: [memberRow], error: null }]);
    const results = await getClubMembers(sb as never, CLUB_ID);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(OTHER);
    expect(results[0].role).toBe('member');
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'query failed' } }]);
    await expect(getClubMembers(sb as never, CLUB_ID)).rejects.toThrow('query failed');
  });
});

// ─── getClubLeaderboard ───────────────────────────────────────────────────────

describe('getClubLeaderboard', () => {
  it('calls the get_club_leaderboard RPC and maps results', async () => {
    const sb = makeSupabase([{ data: [leaderboardRow], error: null }]);
    const results = await getClubLeaderboard(sb as never, CLUB_ID);
    expect(sb.rpc).toHaveBeenCalledWith('get_club_leaderboard', { p_club_id: CLUB_ID });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe(ME);
    expect(results[0].gamesPlayed).toBe(5);
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'rpc failed' } }]);
    await expect(getClubLeaderboard(sb as never, CLUB_ID)).rejects.toThrow('rpc failed');
  });
});

// ─── inviteMember ─────────────────────────────────────────────────────────────

describe('inviteMember', () => {
  it('inserts a club invite', async () => {
    const sb = makeSupabase([{ data: { id: 'inv_1' }, error: null }]);
    await inviteMember(sb as never, CLUB_ID, ME, OTHER);
    expect(sb.from).toHaveBeenCalledWith('club_invites');
  });

  it('throws on supabase error', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'invite failed' } }]);
    await expect(inviteMember(sb as never, CLUB_ID, ME, OTHER)).rejects.toThrow('invite failed');
  });
});
