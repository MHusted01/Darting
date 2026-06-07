import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '@/hooks/usePushToken';

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));

jest.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user-123', isLoaded: true }) }));
jest.mock('@/providers/SupabaseProvider', () => ({ useSupabase: jest.fn() }));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

const mockRequestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock<any>;
const mockGetExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock<any>;

const mockUpdate: jest.Mock<any> = jest.fn();
const mockEq: jest.Mock<any> = jest.fn();
const mockFrom: jest.Mock<any> = jest.fn();
const mockSupabase = { from: mockFrom } as any;

describe('registerPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it('does nothing when push permissions are denied', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await registerPushToken(mockSupabase, 'user-123', 'test-project-id');

    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fetches token and upserts to Supabase when permissions granted', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token]' });

    await registerPushToken(mockSupabase, 'user-123', 'test-project-id');

    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project-id' });
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockUpdate).toHaveBeenCalledWith({ push_token: 'ExponentPushToken[test-token]' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
  });

  it('does nothing when token data is empty', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: null });

    await registerPushToken(mockSupabase, 'user-123', 'test-project-id');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('propagates token fetch error (caller must handle simulator / device errors)', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('Must use physical device'));

    await expect(registerPushToken(mockSupabase, 'user-123', 'test-project-id')).rejects.toThrow(
      'Must use physical device',
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('captures Supabase write error to Sentry', async () => {
    const { captureException } = jest.requireMock('@sentry/react-native') as {
      captureException: jest.Mock<any>;
    };
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
    mockEq.mockResolvedValue({ error: { message: 'RLS violation' } });

    await registerPushToken(mockSupabase, 'user-123', 'test-project-id');

    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'RLS violation' }),
      expect.objectContaining({ tags: { context: 'push_token_upsert' } }),
    );
  });
});
