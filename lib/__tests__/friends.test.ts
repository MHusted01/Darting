import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { removeFriend } from '@/lib/friends';

const mockOr: jest.Mock<any> = jest.fn();
const mockEq: jest.Mock<any> = jest.fn();
const mockDelete: jest.Mock<any> = jest.fn();
const mockFrom: jest.Mock<any> = jest.fn();

const mockSupabase = { from: mockFrom } as any;

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
