import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockImpactAsync = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockNotificationAsync = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockSelectionAsync = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

jest.mock('expo-haptics', () => ({
  impactAsync: (style: unknown) => (mockImpactAsync as jest.Mock)(style),
  notificationAsync: (type: unknown) => (mockNotificationAsync as jest.Mock)(type),
  selectionAsync: () => (mockSelectionAsync as jest.Mock)(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

import { impact, notify, selection } from '@/lib/haptics';

describe('lib/haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('on native', () => {
    it('impact delegates to expo-haptics with light style by default', async () => {
      await impact();
      expect(mockImpactAsync).toHaveBeenCalledWith('light');
    });

    it('impact passes the requested style', async () => {
      await impact('medium');
      expect(mockImpactAsync).toHaveBeenCalledWith('medium');
    });

    it('notify delegates with success type by default', async () => {
      await notify();
      expect(mockNotificationAsync).toHaveBeenCalledWith('success');
    });

    it('notify passes the requested type', async () => {
      await notify('error');
      expect(mockNotificationAsync).toHaveBeenCalledWith('error');
    });

    it('selection delegates to expo-haptics', async () => {
      await selection();
      expect(mockSelectionAsync).toHaveBeenCalled();
    });

    it('swallows rejections from expo-haptics', async () => {
      mockImpactAsync.mockRejectedValueOnce(new Error('not supported'));
      mockNotificationAsync.mockRejectedValueOnce(new Error('not supported'));
      mockSelectionAsync.mockRejectedValueOnce(new Error('not supported'));
      await expect(impact()).resolves.toBeUndefined();
      await expect(notify()).resolves.toBeUndefined();
      await expect(selection()).resolves.toBeUndefined();
    });
  });

  describe('on web', () => {
    let osSpy: { restore: () => void };

    beforeEach(() => {
      osSpy = jest.replaceProperty(Platform, 'OS', 'web');
    });

    afterEach(() => {
      osSpy.restore();
    });

    it('impact is a no-op', async () => {
      await impact('heavy');
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('notify is a no-op', async () => {
      await notify('warning');
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });

    it('selection is a no-op', async () => {
      await selection();
      expect(mockSelectionAsync).not.toHaveBeenCalled();
    });
  });
});
