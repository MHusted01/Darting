import { describe, expect, it } from '@jest/globals';
import { getNextAvatarColor } from '@/components/PlayerManager';

describe('getNextAvatarColor', () => {
  it('returns colors in palette order and wraps around', () => {
    expect(getNextAvatarColor(0)).toBe('#6366f1');
    expect(getNextAvatarColor(1)).toBe('#10b981');
    expect(getNextAvatarColor(7)).toBe('#14b8a6');
    expect(getNextAvatarColor(8)).toBe('#6366f1');
  });
});
