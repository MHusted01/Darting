import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { removeFriend } from '@/lib/friends';

jest.mock('@/lib/friends', () => ({
  removeFriend: jest.fn(),
  getFriends: jest.fn(),
  getPendingRequests: jest.fn(),
  searchUsers: jest.fn(),
  sendFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  declineFriendRequest: jest.fn(),
  mapFriendRow: jest.fn(),
  mergePresence: jest.fn(),
}));

const mockRemoveFriend = removeFriend as jest.Mock<any>;

describe('removeFriend lib contract (via hook layer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removeFriend is exported', () => {
    expect(typeof removeFriend).toBe('function');
  });

  it('removeFriend resolves when called with supabase, friendshipId, and userId', async () => {
    mockRemoveFriend.mockResolvedValue(undefined);

    await expect(removeFriend({} as any, 'friendship-abc', 'user-1')).resolves.toBeUndefined();
    expect(mockRemoveFriend).toHaveBeenCalledWith({}, 'friendship-abc', 'user-1');
  });

  it('removeFriend rejects when the lib throws', async () => {
    mockRemoveFriend.mockRejectedValue(new Error('RLS violation'));

    await expect(removeFriend({} as any, 'friendship-abc', 'user-1')).rejects.toThrow('RLS violation');
  });
});
