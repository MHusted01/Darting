import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/db/client', () => ({ db: {} }));

import {
  aggregateCheckoutStats,
  aggregatePerGameKPIs,
  computeSetupShotQuality,
  splitPressureRows,
  mapTrendRows,
  type CheckoutSummary,
} from '@/lib/stats';
import type { PlayerAnalytics, X01KPIs } from '@/lib/games/analytics';

function x01Analytics(partial: Partial<X01KPIs>): PlayerAnalytics {
  return {
    dartCounts: {},
    perGameKPIs: {
      threeDartAvg: 0,
      first9DartAvg: null,
      bustRate: 0,
      tonCount: 0,
      ton40Count: 0,
      ton80Count: 0,
      highestCheckout: null,
      checkoutRate: 0,
      consistency: null,
      leaves: {},
      ...partial,
    },
    checkoutStats: null,
  };
}

describe('aggregateCheckoutStats — estimated attempts', () => {
  it('folds inferred attempts into the combined rate and flags estimated', () => {
    const rows = [
      {
        analytics: {
          dartCounts: {},
          perGameKPIs: {},
          checkoutStats: {
            attempts: 2,
            successes: 1,
            byDouble: { 20: { attempts: 2, successes: 1 } },
            inferredAttempts: 2,
            inferredByDouble: { 20: 2 },
          },
        } as unknown as PlayerAnalytics,
      },
    ];
    const summary = aggregateCheckoutStats(rows);
    expect(summary.totalAttempts).toBe(2);
    expect(summary.inferredAttempts).toBe(2);
    // combined denominator = 2 explicit + 2 inferred = 4, successes = 1
    expect(summary.overallRate).toBeCloseTo(0.25, 5);
    expect(summary.estimated).toBe(true);
  });

  it('is not estimated and matches the plain rate when there are no inferred attempts', () => {
    const rows = [
      {
        analytics: {
          dartCounts: {},
          perGameKPIs: {},
          checkoutStats: {
            attempts: 4,
            successes: 2,
            byDouble: {},
            inferredAttempts: 0,
            inferredByDouble: {},
          },
        } as unknown as PlayerAnalytics,
      },
    ];
    const summary = aggregateCheckoutStats(rows);
    expect(summary.estimated).toBe(false);
    expect(summary.overallRate).toBeCloseTo(0.5, 5);
  });

  it('treats missing inferred fields (historical analytics) as zero', () => {
    const rows = [
      {
        analytics: {
          dartCounts: {},
          perGameKPIs: {},
          checkoutStats: { attempts: 2, successes: 1, byDouble: {} },
        } as unknown as PlayerAnalytics,
      },
    ];
    const summary: CheckoutSummary = aggregateCheckoutStats(rows);
    expect(summary.inferredAttempts).toBe(0);
    expect(summary.estimated).toBe(false);
    expect(summary.overallRate).toBeCloseTo(0.5, 5);
  });
});

describe('computeSetupShotQuality', () => {
  it('is the fraction of finishable leaves that are preferred doubles', () => {
    // 40 is preferred; 41 and 60 are finishable but not preferred; 161 is out of finishable range
    const leaves = { '40': 2, '41': 1, '60': 1, '161': 5 };
    expect(computeSetupShotQuality(leaves)).toBeCloseTo(2 / 4, 5);
  });

  it('returns null when there are no finishable leaves', () => {
    expect(computeSetupShotQuality({})).toBeNull();
    expect(computeSetupShotQuality({ '161': 3 })).toBeNull();
  });
});

describe('aggregatePerGameKPIs — x01 coaching metrics', () => {
  it('averages consistency, pools leaves, derives setup quality and common leaves', () => {
    const rows = [
      { gameSlug: 'x01', analytics: x01Analytics({ consistency: 20, leaves: { '40': 1, '60': 1 } }) },
      { gameSlug: 'x01', analytics: x01Analytics({ consistency: 40, leaves: { '40': 1, '32': 1 } }) },
    ];
    const kpis = aggregatePerGameKPIs(rows, 'x01');
    expect(kpis?.type).toBe('x01');
    if (kpis?.type !== 'x01') throw new Error('expected x01');
    expect(kpis.consistency).toBeCloseTo(30, 5); // (20 + 40) / 2
    // pooled leaves: 40 -> 2, 60 -> 1, 32 -> 1; preferred = 40(2) + 32(1) = 3 of 4 finishable
    expect(kpis.setupShotQuality).toBeCloseTo(3 / 4, 5);
    expect(kpis.commonLeaves[0]).toEqual({ remaining: 40, count: 2 });
  });
});

describe('splitPressureRows', () => {
  it('partitions rows into casual and competitive (tournament + realtime) aggregates', () => {
    const rows = [
      { gameSlug: 'x01', context: 'casual' as const, analytics: x01Analytics({ threeDartAvg: 50 }) },
      { gameSlug: 'x01', context: 'tournament' as const, analytics: x01Analytics({ threeDartAvg: 60 }) },
      { gameSlug: 'x01', context: 'realtime' as const, analytics: x01Analytics({ threeDartAvg: 70 }) },
    ];
    const split = splitPressureRows(rows, 'x01');
    expect(split.casual?.type).toBe('x01');
    expect(split.competitive?.type).toBe('x01');
    if (split.casual?.type === 'x01') expect(split.casual.threeDartAvg).toBeCloseTo(50, 5);
    if (split.competitive?.type === 'x01') expect(split.competitive.threeDartAvg).toBeCloseTo(65, 5); // (60 + 70) / 2
  });

  it('returns null for a bucket with no rows', () => {
    const rows = [
      { gameSlug: 'x01', context: 'casual' as const, analytics: x01Analytics({ threeDartAvg: 50 }) },
    ];
    const split = splitPressureRows(rows, 'x01');
    expect(split.competitive).toBeNull();
  });
});

describe('mapTrendRows', () => {
  it('extracts first9DartAvg from analytics alongside threeDartAvg', () => {
    const points = mapTrendRows([
      {
        sessionId: 1,
        completedAt: 1000,
        threeDartAvg: 55,
        gameSlug: 'x01',
        analytics: x01Analytics({ first9DartAvg: 62 }),
      },
    ]);
    expect(points[0].threeDartAvg).toBe(55);
    expect(points[0].first9DartAvg).toBe(62);
  });

  it('defaults first9DartAvg to null for non-x01 / missing analytics', () => {
    const points = mapTrendRows([
      { sessionId: 2, completedAt: 2000, threeDartAvg: null, gameSlug: 'cricket', analytics: null },
    ]);
    expect(points[0].first9DartAvg).toBeNull();
  });
});
