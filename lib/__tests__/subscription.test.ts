import { describe, expect, it } from '@jest/globals';
import { useFeatureGate, type FeatureName } from '@/lib/subscription';

const ALL_GATES: FeatureName[] = [
  'UNLIMITED_STATS_HISTORY',
  'CREATE_TOURNAMENT',
  'AI_COACHING',
  'REALTIME_GAMES',
  'CREATE_CLUBS_UNLIMITED',
  'JOIN_CLUBS_UNLIMITED',
];

describe('useFeatureGate', () => {
  it.each(ALL_GATES)('returns true for %s', (gate) => {
    expect(useFeatureGate(gate)).toBe(true);
  });
});
