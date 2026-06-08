import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/db/client', () => ({ db: {} }));

import {
  aggregateSegmentAccuracy,
  buildCheckoutBestWorst,
  aggregateCheckoutStats,
  aggregatePerGameKPIs,
} from '@/lib/stats';
import type { PlayerAnalytics } from '@/lib/games/analytics';

type Row = { analytics: PlayerAnalytics | null; gameSlug: string };

const makeX01Analytics = (kpiOverrides: Record<string, unknown> = {}): PlayerAnalytics => ({
  dartCounts: { '20': { singles: 5, doubles: 2, triples: 1 }, '19': { singles: 3, doubles: 1, triples: 0 } },
  perGameKPIs: {
    threeDartAvg: 60,
    first9DartAvg: 55,
    bustRate: 0.1,
    tonCount: 2,
    ton40Count: 1,
    ton80Count: 0,
    highestCheckout: 40,
    checkoutRate: 0.5,
    ...kpiOverrides,
  },
  checkoutStats: {
    attempts: 10,
    successes: 5,
    byDouble: { 20: { attempts: 5, successes: 3 }, 16: { attempts: 5, successes: 2 } },
  },
});

const makeCricketAnalytics = (mpr: number): PlayerAnalytics => ({
  dartCounts: {},
  perGameKPIs: { marksPerRound: mpr, hitRateBySegment: { 20: 0.8, 19: 0.6 } },
  checkoutStats: null,
});

const makeTargetAnalytics = (totalDarts: number, totalHits: number): PlayerAnalytics => ({
  dartCounts: {},
  perGameKPIs: {
    hitRateByRound: {
      1: { darts: 3, hits: 2, rate: 0.67 },
      2: { darts: 4, hits: 1, rate: 0.25 },
    },
    totalDarts,
    totalHits,
    overallHitRate: totalDarts > 0 ? totalHits / totalDarts : 0,
  },
  checkoutStats: null,
});

describe('aggregateSegmentAccuracy', () => {
  it('returns empty object for empty rows', () => {
    expect(aggregateSegmentAccuracy([])).toEqual({});
  });

  it('returns empty object when all analytics are null', () => {
    const result = aggregateSegmentAccuracy([{ analytics: null }, { analytics: null }]);
    expect(result).toEqual({});
  });

  it('counts singles, doubles, triples per segment', () => {
    const analytics: PlayerAnalytics = {
      dartCounts: { '20': { singles: 3, doubles: 2, triples: 1 }, '19': { singles: 1, doubles: 0, triples: 0 } },
      perGameKPIs: {},
      checkoutStats: null,
    };
    const result = aggregateSegmentAccuracy([{ analytics }]);
    expect(result['20'].singles).toBe(3);
    expect(result['20'].doubles).toBe(2);
    expect(result['20'].triples).toBe(1);
    expect(result['19'].singles).toBe(1);
    expect(result['19'].doubles).toBe(0);
    expect(result['19'].triples).toBe(0);
  });

  it('aggregates across multiple sessions', () => {
    const a1: PlayerAnalytics = { dartCounts: { '20': { singles: 2, doubles: 1, triples: 0 } }, perGameKPIs: {}, checkoutStats: null };
    const a2: PlayerAnalytics = { dartCounts: { '20': { singles: 3, doubles: 0, triples: 1 } }, perGameKPIs: {}, checkoutStats: null };
    const result = aggregateSegmentAccuracy([{ analytics: a1 }, { analytics: a2 }]);
    expect(result['20'].singles).toBe(5);
    expect(result['20'].doubles).toBe(1);
    expect(result['20'].triples).toBe(1);
  });

  it('computes throwShare as proportion of throws for this segment over total throws', () => {
    const analytics: PlayerAnalytics = {
      dartCounts: {
        '20': { singles: 6, doubles: 0, triples: 0 },
        '19': { singles: 4, doubles: 0, triples: 0 },
      },
      perGameKPIs: {},
      checkoutStats: null,
    };
    const result = aggregateSegmentAccuracy([{ analytics }]);
    expect(result['20'].throwShare).toBeCloseTo(0.6);
    expect(result['19'].throwShare).toBeCloseTo(0.4);
  });

  it('throwShare sums to 1 across all segments', () => {
    const analytics: PlayerAnalytics = {
      dartCounts: {
        '20': { singles: 3, doubles: 2, triples: 0 },
        '19': { singles: 2, doubles: 1, triples: 0 },
        '18': { singles: 1, doubles: 1, triples: 1 },
      },
      perGameKPIs: {},
      checkoutStats: null,
    };
    const result = aggregateSegmentAccuracy([{ analytics }]);
    const totalRate = Object.values(result).reduce((s, stat) => s + stat.throwShare, 0);
    expect(totalRate).toBeCloseTo(1.0);
  });

  it('skips null analytics rows silently', () => {
    const analytics: PlayerAnalytics = { dartCounts: { '20': { singles: 4, doubles: 0, triples: 0 } }, perGameKPIs: {}, checkoutStats: null };
    const result = aggregateSegmentAccuracy([{ analytics: null }, { analytics }, { analytics: null }]);
    expect(result['20'].singles).toBe(4);
    expect(result['20'].throwShare).toBeCloseTo(1.0);
  });
});

describe('buildCheckoutBestWorst', () => {
  it('returns empty lists when no entries', () => {
    const result = buildCheckoutBestWorst({});
    expect(result.best).toHaveLength(0);
    expect(result.worst).toHaveLength(0);
  });

  it('filters entries with fewer than 3 attempts', () => {
    const result = buildCheckoutBestWorst({ '20': { attempts: 2, successes: 2 } });
    expect(result.best).toHaveLength(0);
    expect(result.worst).toHaveLength(0);
  });

  it('includes entries with exactly 3 attempts', () => {
    const result = buildCheckoutBestWorst({ '20': { attempts: 3, successes: 3 } });
    expect(result.best).toHaveLength(1);
    expect(result.best[0].segment).toBe(20);
    expect(result.best[0].rate).toBeCloseTo(1.0);
  });

  it('sorts best by rate descending', () => {
    const byDouble = {
      '20': { attempts: 10, successes: 8 },
      '16': { attempts: 10, successes: 3 },
      '10': { attempts: 10, successes: 5 },
    };
    const { best } = buildCheckoutBestWorst(byDouble);
    expect(best[0].segment).toBe(20);
    expect(best[1].segment).toBe(10);
    expect(best[2].segment).toBe(16);
  });

  it('sorts worst by rate ascending', () => {
    const byDouble = {
      '20': { attempts: 10, successes: 8 },
      '16': { attempts: 10, successes: 3 },
      '10': { attempts: 10, successes: 5 },
    };
    const { worst } = buildCheckoutBestWorst(byDouble);
    expect(worst[0].segment).toBe(16);
    expect(worst[1].segment).toBe(10);
    expect(worst[2].segment).toBe(20);
  });

  it('limits best and worst to 3 each', () => {
    const byDouble: Record<string, { attempts: number; successes: number }> = {};
    for (let i = 1; i <= 10; i++) {
      byDouble[String(i)] = { attempts: 5, successes: i % 5 };
    }
    const { best, worst } = buildCheckoutBestWorst(byDouble);
    expect(best).toHaveLength(3);
    expect(worst).toHaveLength(3);
  });

  it('computes rate correctly on each entry', () => {
    const { best } = buildCheckoutBestWorst({ '20': { attempts: 4, successes: 2 } });
    expect(best[0].rate).toBeCloseTo(0.5);
    expect(best[0].attempts).toBe(4);
    expect(best[0].successes).toBe(2);
  });
});

describe('aggregateCheckoutStats', () => {
  it('returns zeroed summary for empty rows', () => {
    const result = aggregateCheckoutStats([]);
    expect(result.totalAttempts).toBe(0);
    expect(result.totalSuccesses).toBe(0);
    expect(result.overallRate).toBe(0);
    expect(result.bestDoubles).toHaveLength(0);
    expect(result.worstDoubles).toHaveLength(0);
  });

  it('skips rows with null analytics', () => {
    const result = aggregateCheckoutStats([{ analytics: null }]);
    expect(result.totalAttempts).toBe(0);
  });

  it('skips rows with null checkoutStats', () => {
    const analytics: PlayerAnalytics = { dartCounts: {}, perGameKPIs: {}, checkoutStats: null };
    const result = aggregateCheckoutStats([{ analytics }]);
    expect(result.totalAttempts).toBe(0);
  });

  it('sums attempts and successes across sessions', () => {
    const a1 = makeX01Analytics();
    const a2 = makeX01Analytics();
    const result = aggregateCheckoutStats([{ analytics: a1 }, { analytics: a2 }]);
    expect(result.totalAttempts).toBe(20);
    expect(result.totalSuccesses).toBe(10);
    expect(result.overallRate).toBeCloseTo(0.5);
  });

  it('merges byDouble entries across sessions', () => {
    const a1 = makeX01Analytics();
    const a2 = makeX01Analytics();
    const result = aggregateCheckoutStats([{ analytics: a1 }, { analytics: a2 }]);
    expect(result.byDouble['20'].attempts).toBe(10);
    expect(result.byDouble['20'].successes).toBe(6);
    expect(result.byDouble['16'].attempts).toBe(10);
    expect(result.byDouble['16'].successes).toBe(4);
  });

  it('computes overallRate as successes / attempts', () => {
    const analytics: PlayerAnalytics = {
      dartCounts: {},
      perGameKPIs: {},
      checkoutStats: { attempts: 8, successes: 2, byDouble: {} },
    };
    const result = aggregateCheckoutStats([{ analytics }]);
    expect(result.overallRate).toBeCloseTo(0.25);
  });
});

describe('aggregatePerGameKPIs', () => {
  it('returns null for empty rows', () => {
    expect(aggregatePerGameKPIs([], 'x01')).toBeNull();
  });

  it('returns null when all analytics are null', () => {
    const rows: Row[] = [{ analytics: null, gameSlug: 'x01' }];
    expect(aggregatePerGameKPIs(rows, 'x01')).toBeNull();
  });

  it('aggregates X01 KPIs: averages avgs and rates', () => {
    const a1 = makeX01Analytics({ threeDartAvg: 60, bustRate: 0.1, checkoutRate: 0.4 });
    const a2 = makeX01Analytics({ threeDartAvg: 80, bustRate: 0.2, checkoutRate: 0.6 });
    const rows: Row[] = [{ analytics: a1, gameSlug: 'x01' }, { analytics: a2, gameSlug: 'x01' }];
    const result = aggregatePerGameKPIs(rows, 'x01');
    expect(result?.type).toBe('x01');
    if (!result || result.type !== 'x01') return;
    expect(result.threeDartAvg).toBeCloseTo(70);
    expect(result.bustRate).toBeCloseTo(0.15);
    expect(result.checkoutRate).toBeCloseTo(0.5);
  });

  it('aggregates X01 KPIs: sums ton counts', () => {
    const a1 = makeX01Analytics({ tonCount: 2, ton40Count: 1, ton80Count: 0 });
    const a2 = makeX01Analytics({ tonCount: 3, ton40Count: 2, ton80Count: 1 });
    const rows: Row[] = [{ analytics: a1, gameSlug: 'x01' }, { analytics: a2, gameSlug: 'x01' }];
    const result = aggregatePerGameKPIs(rows, 'x01');
    if (!result || result.type !== 'x01') return;
    expect(result.tonCount).toBe(5);
    expect(result.ton40Count).toBe(3);
    expect(result.ton80Count).toBe(1);
  });

  it('aggregates X01 KPIs: max highestCheckout', () => {
    const a1 = makeX01Analytics({ highestCheckout: 40 });
    const a2 = makeX01Analytics({ highestCheckout: 110 });
    const rows: Row[] = [{ analytics: a1, gameSlug: 'x01' }, { analytics: a2, gameSlug: 'x01' }];
    const result = aggregatePerGameKPIs(rows, 'x01');
    if (!result || result.type !== 'x01') return;
    expect(result.highestCheckout).toBe(110);
  });

  it('aggregates Cricket KPIs: averages MPR', () => {
    const a1 = makeCricketAnalytics(3.5);
    const a2 = makeCricketAnalytics(2.5);
    const rows: Row[] = [{ analytics: a1, gameSlug: 'cricket' }, { analytics: a2, gameSlug: 'cricket' }];
    const result = aggregatePerGameKPIs(rows, 'cricket');
    expect(result?.type).toBe('cricket');
    if (!result || result.type !== 'cricket') return;
    expect(result.marksPerRound).toBeCloseTo(3.0);
  });

  it('aggregates target game KPIs: sums darts and hits per round', () => {
    const a1 = makeTargetAnalytics(20, 10);
    const a2 = makeTargetAnalytics(30, 15);
    const rows: Row[] = [
      { analytics: a1, gameSlug: 'around-the-clock' },
      { analytics: a2, gameSlug: 'around-the-clock' },
    ];
    const result = aggregatePerGameKPIs(rows, 'around-the-clock');
    expect(result?.type).toBe('target');
    if (!result || result.type !== 'target') return;
    expect(result.hitRateByRound[1].darts).toBe(6);
    expect(result.hitRateByRound[1].hits).toBe(4);
    expect(result.hitRateByRound[1].rate).toBeCloseTo(4 / 6);
  });

  it('returns null for unknown game slug', () => {
    const analytics: PlayerAnalytics = { dartCounts: {}, perGameKPIs: {}, checkoutStats: null };
    const result = aggregatePerGameKPIs([{ analytics, gameSlug: 'killer' }], 'killer');
    expect(result).toBeNull();
  });
});
