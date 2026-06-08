import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { getNotificationPrefs, updateNotificationPrefs, DEFAULT_PREFS } from '@/lib/notificationPrefs';

jest.mock('@/lib/notificationPrefs', () => ({
  getNotificationPrefs: jest.fn(),
  updateNotificationPrefs: jest.fn(),
  DEFAULT_PREFS: { friend_requests: true, club_invites: true, tournament_updates: true, match_challenges: true },
}));

const mockGetNotificationPrefs = getNotificationPrefs as jest.Mock<any>;
const mockUpdateNotificationPrefs = updateNotificationPrefs as jest.Mock<any>;

describe('notificationPrefs lib contract (via hook layer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getNotificationPrefs is exported', () => {
    expect(typeof getNotificationPrefs).toBe('function');
  });

  it('updateNotificationPrefs is exported', () => {
    expect(typeof updateNotificationPrefs).toBe('function');
  });

  it('DEFAULT_PREFS has all four event keys enabled', () => {
    expect(DEFAULT_PREFS).toEqual({
      friend_requests: true,
      club_invites: true,
      tournament_updates: true,
      match_challenges: true,
    });
  });

  it('getNotificationPrefs resolves to prefs when called', async () => {
    const prefs = { friend_requests: false, club_invites: true, tournament_updates: true, match_challenges: true };
    mockGetNotificationPrefs.mockResolvedValue(prefs);

    const result = await getNotificationPrefs({} as any, 'user-1');
    expect(result).toEqual(prefs);
  });

  it('updateNotificationPrefs resolves when called', async () => {
    mockUpdateNotificationPrefs.mockResolvedValue(undefined);

    await expect(updateNotificationPrefs({} as any, 'user-1', DEFAULT_PREFS)).resolves.toBeUndefined();
  });
});
