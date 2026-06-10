import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { getFriends, getFriendThreeDartAvgs, mapFriendRow, removeFriend } from '@/lib/friends';

const mockOr: jest.Mock<any> = jest.fn();
const mockEq: jest.Mock<any> = jest.fn();
const mockDelete: jest.Mock<any> = jest.fn();
const mockFrom: jest.Mock<any> = jest.fn();

const mockSupabase = { from: mockFrom } as any;

const friendshipRow = {
  id: 'friendship-1',
  requester_id: 'user-1',
  addressee_id: 'user-2',
  requester: { id: 'user-1', first_name: 'Me', last_name: 'User', avatar_url: null, username: 'me' },
  addressee: { id: 'user-2', first_name: 'Jane', last_name: 'Doe', avatar_url: null, username: 'jane' },
};

describe('mapFriendRow', () => {
  it('populates threeDartAvg from the avg map', () => {
    const avgs = new Map([['user-2', 54.3]]);
    const friend = mapFriendRow(friendshipRow, 'user-1', avgs);
    expect(friend.id).toBe('user-2');
    expect(friend.threeDartAvg).toBeCloseTo(54.3);
  });

  it('returns null threeDartAvg when the friend has no x01 average', () => {
    const friend = mapFriendRow(friendshipRow, 'user-1', new Map());
    expect(friend.threeDartAvg).toBeNull();
  });

  it('returns null threeDartAvg when no avg map is provided', () => {
    const friend = mapFriendRow(friendshipRow, 'user-1');
    expect(friend.threeDartAvg).toBeNull();
  });
});

describe('getFriendThreeDartAvgs', () => {
  it('calls the get_friends_three_dart_avgs RPC and maps rows to a Map', async () => {
    const rpc = jest.fn<any>().mockResolvedValue({
      data: [
        { friend_id: 'user-2', avg_three_dart_avg: 51.7 },
        { friend_id: 'user-3', avg_three_dart_avg: null },
      ],
      error: null,
    });
    const avgs = await getFriendThreeDartAvgs({ rpc } as any);

    expect(rpc).toHaveBeenCalledWith('get_friends_three_dart_avgs');
    expect(avgs.get('user-2')).toBeCloseTo(51.7);
    expect(avgs.has('user-3')).toBe(false);
  });

  it('returns an empty Map when the RPC errors (non-fatal)', async () => {
    const rpc = jest.fn<any>().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const avgs = await getFriendThreeDartAvgs({ rpc } as any);
    expect(avgs.size).toBe(0);
  });
});

describe('getFriends', () => {
  it('merges RPC averages into friend rows', async () => {
    const friendshipsResult = { data: [friendshipRow], error: null };
    const eqFn = jest.fn<any>().mockResolvedValue(friendshipsResult);
    const orFn = jest.fn(() => ({ eq: eqFn }));
    const selectFn = jest.fn(() => ({ or: orFn }));
    const supabase = {
      from: jest.fn(() => ({ select: selectFn })),
      rpc: jest.fn<any>().mockResolvedValue({
        data: [{ friend_id: 'user-2', avg_three_dart_avg: 48.9 }],
        error: null,
      }),
    } as any;

    const friends = await getFriends(supabase, 'user-1');

    expect(supabase.rpc).toHaveBeenCalledWith('get_friends_three_dart_avgs');
    expect(friends).toHaveLength(1);
    expect(friends[0].id).toBe('user-2');
    expect(friends[0].threeDartAvg).toBeCloseTo(48.9);
  });
});

describe('removeFriend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOr.mockResolvedValue({ error: null });
    mockEq.mockReturnValue({ or: mockOr });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ delete: mockDelete });
  });

  it('deletes the friendship row scoped to the calling user', async () => {
    await removeFriend(mockSupabase, 'friendship-abc', 'user-1');

    expect(mockFrom).toHaveBeenCalledWith('friendships');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'friendship-abc');
    expect(mockOr).toHaveBeenCalledWith('requester_id.eq.user-1,addressee_id.eq.user-1');
  });

  it('throws when Supabase returns an error', async () => {
    mockOr.mockResolvedValue({ error: { message: 'RLS violation' } });

    await expect(removeFriend(mockSupabase, 'friendship-abc', 'user-1')).rejects.toThrow('RLS violation');
  });
});
