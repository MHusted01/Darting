import { describe, expect, it } from '@jest/globals';
import { useFeatureGate, type FeatureName } from '@/lib/subscription';

const ALL_GATES = [
  'UNLIMITED_STATS_HISTORY',
  'CREATE_TOURNAMENT',
  'AI_COACHING',
  'REALTIME_GAMES',
  'CREATE_CLUBS_UNLIMITED',
  'JOIN_CLUBS_UNLIMITED',
] as const satisfies FeatureName[];

type _Exhaustive = Exclude<FeatureName, (typeof ALL_GATES)[number]>;
// If this errors, a FeatureName was added to lib/subscription.ts but not to ALL_GATES above.
const _check: _Exhaustive extends never ? true : never = true;
void _check;

describe('useFeatureGate', () => {
  it.each(ALL_GATES)('returns true for %s', (gate) => {
    expect(useFeatureGate(gate)).toBe(true);
  });
});
