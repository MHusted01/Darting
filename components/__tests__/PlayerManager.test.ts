import { describe, expect, it } from '@jest/globals';
import { AVATAR_COLORS, getNextAvatarColor } from '@/components/PlayerManager';

describe('getNextAvatarColor', () => {
  it('returns colors in palette order and wraps around', () => {
    expect(getNextAvatarColor(0)).toBe(AVATAR_COLORS[0]);
    expect(getNextAvatarColor(1)).toBe(AVATAR_COLORS[1]);
    expect(getNextAvatarColor(7)).toBe(AVATAR_COLORS[7]);
    expect(getNextAvatarColor(8)).toBe(AVATAR_COLORS[0]);
  });
});
