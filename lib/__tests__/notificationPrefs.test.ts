import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { getNotificationPrefs, updateNotificationPrefs, DEFAULT_PREFS } from '@/lib/notificationPrefs';

const mockSingle: jest.Mock<any> = jest.fn();
const mockEq: jest.Mock<any> = jest.fn();
const mockSelect: jest.Mock<any> = jest.fn();
const mockUpdateEq: jest.Mock<any> = jest.fn();
const mockUpdate: jest.Mock<any> = jest.fn();
const mockFrom: jest.Mock<any> = jest.fn();

const mockSupabase = { from: mockFrom } as any;

describe('getNotificationPrefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('returns prefs from Supabase when present', async () => {
    const prefs = { friend_requests: false, club_invites: true, tournament_updates: true, match_challenges: false };
    mockSingle.mockResolvedValue({ data: { notification_prefs: prefs }, error: null });

    const result = await getNotificationPrefs(mockSupabase, 'user-1');

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockSelect).toHaveBeenCalledWith('notification_prefs');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(result).toEqual(prefs);
  });

  it('returns DEFAULT_PREFS when notification_prefs is null', async () => {
    mockSingle.mockResolvedValue({ data: { notification_prefs: null }, error: null });

    const result = await getNotificationPrefs(mockSupabase, 'user-1');

    expect(result).toEqual(DEFAULT_PREFS);
  });

  it('normalizes partial JSON by falling back to DEFAULT_PREFS for missing keys', async () => {
    mockSingle.mockResolvedValue({
      data: { notification_prefs: { friend_requests: false } },
      error: null,
    });

    const result = await getNotificationPrefs(mockSupabase, 'user-1');

    expect(result).toEqual({
      friend_requests: false,
      club_invites: DEFAULT_PREFS.club_invites,
      tournament_updates: DEFAULT_PREFS.tournament_updates,
      match_challenges: DEFAULT_PREFS.match_challenges,
    });
  });

  it('throws when Supabase returns an error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    await expect(getNotificationPrefs(mockSupabase, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('updateNotificationPrefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it('updates notification_prefs for the given user', async () => {
    const prefs = { friend_requests: false, club_invites: true, tournament_updates: true, match_challenges: true };

    await updateNotificationPrefs(mockSupabase, 'user-1', prefs);

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockUpdate).toHaveBeenCalledWith({ notification_prefs: prefs });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when Supabase returns an error', async () => {
    mockUpdateEq.mockResolvedValue({ error: { message: 'RLS violation' } });

    await expect(updateNotificationPrefs(mockSupabase, 'user-1', DEFAULT_PREFS)).rejects.toThrow('RLS violation');
  });
});
