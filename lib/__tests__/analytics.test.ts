import { describe, expect, it } from '@jest/globals';
import {
  computeDartCounts,
  computeX01KPIs,
  computeCheckoutStats,
  computeCricketKPIs,
  computeTargetGameKPIs,
  computeHighScoreKPIs,
  computeSessionAnalytics,
  type PlayerAnalytics,
  type X01KPIs,
  type CricketKPIs,
  type TargetGameKPIs,
  type HighScoreKPIs,
  type CheckoutStats,
} from '@/lib/games/analytics';

type DartThrow = { segment: number; multiplier: number };
type Turn = {
  roundNumber: number;
  darts: DartThrow[];
  scoreDelta: number;
  intendedTarget?: number | null;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T20: DartThrow = { segment: 20, multiplier: 3 }; // 60
const D20: DartThrow = { segment: 20, multiplier: 2 }; // 40
const S20: DartThrow = { segment: 20, multiplier: 1 }; // 20
const S19: DartThrow = { segment: 19, multiplier: 1 }; // 19
const D16: DartThrow = { segment: 16, multiplier: 2 }; // 32
const S9: DartThrow = { segment: 9, multiplier: 1 };   // 9
const S1: DartThrow = { segment: 1, multiplier: 1 };   // 1
const D1: DartThrow = { segment: 1, multiplier: 2 };   // 2
const S15: DartThrow = { segment: 15, multiplier: 1 };
const T15: DartThrow = { segment: 15, multiplier: 3 };
const S18: DartThrow = { segment: 18, multiplier: 1 };
const MISS: DartThrow = { segment: 0, multiplier: 0 };

// ---------------------------------------------------------------------------
// computeDartCounts
// ---------------------------------------------------------------------------

describe('computeDartCounts', () => {
  it('returns all-zero counts for empty turns', () => {
    const counts = computeDartCounts([]);
    expect(counts).toEqual({});
  });

  it('counts singles, doubles, triples per segment', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, D20, T20], scoreDelta: 120 },
    ];
    const counts = computeDartCounts(turns);
    expect(counts['20']).toEqual({ singles: 1, doubles: 1, triples: 1 });
  });

  it('ignores misses (segment 0 or multiplier 0)', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [MISS, S20, MISS], scoreDelta: 20 },
    ];
    const counts = computeDartCounts(turns);
    expect(counts['20']).toEqual({ singles: 1, doubles: 0, triples: 0 });
    expect(counts['0']).toBeUndefined();
  });

  it('accumulates across multiple turns', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, S20, S20], scoreDelta: 60 },
      { roundNumber: 2, darts: [D20, MISS, MISS], scoreDelta: 40 },
    ];
    const counts = computeDartCounts(turns);
    expect(counts['20']).toEqual({ singles: 3, doubles: 1, triples: 0 });
  });

  it('tracks bull (segment 25) separately from double bull', () => {
    const S25: DartThrow = { segment: 25, multiplier: 1 };
    const D25: DartThrow = { segment: 25, multiplier: 2 };
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S25, D25], scoreDelta: 75 },
    ];
    const counts = computeDartCounts(turns);
    expect(counts['25']).toEqual({ singles: 1, doubles: 1, triples: 0 });
  });

  it('handles multiple segments in one turn', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, S19, S18], scoreDelta: 57 },
    ];
    const counts = computeDartCounts(turns);
    expect(counts['20']).toEqual({ singles: 1, doubles: 0, triples: 0 });
    expect(counts['19']).toEqual({ singles: 1, doubles: 0, triples: 0 });
    expect(counts['18']).toEqual({ singles: 1, doubles: 0, triples: 0 });
  });
});

// ---------------------------------------------------------------------------
// computeX01KPIs
// ---------------------------------------------------------------------------

describe('computeX01KPIs', () => {
  it('computes 3-dart average correctly', () => {
    // 3 turns: 60+60+60=180, 60+60+20=140, 60+60+19=139
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [T20, T20, S20], scoreDelta: 140 },
      { roundNumber: 3, darts: [T20, T20, S19], scoreDelta: 139 },
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    // total scored = 459, total darts = 9, avg = 459/9*3 = 153
    expect(kpis.threeDartAvg).toBeCloseTo(153, 1);
  });

  it('counts 180s, 140s, and 100+ tons correctly', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [T20, T20, S20], scoreDelta: 140 },
      { roundNumber: 3, darts: [T20, T20, MISS], scoreDelta: 120 },
      { roundNumber: 4, darts: [S20, S20, S20], scoreDelta: 60 },
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    expect(kpis.ton80Count).toBe(1);
    expect(kpis.ton40Count).toBe(1);
    expect(kpis.tonCount).toBe(1);
  });

  it('detects busts and computes bust rate', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      // bust: darts scored but scoreDelta=0
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 0 },
      { roundNumber: 3, darts: [T20, T20, S20], scoreDelta: 140 },
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    // 1 bust out of 3 turns
    expect(kpis.bustRate).toBeCloseTo(1 / 3, 2);
  });

  it('does not count all-miss turns as busts', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [MISS, MISS, MISS], scoreDelta: 0 },
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 180 },
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    expect(kpis.bustRate).toBe(0);
  });

  it('computes first-9-dart average from first 3 turns', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 3, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 4, darts: [S1, S1, S1], scoreDelta: 3 },
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    expect(kpis.first9DartAvg).toBeCloseTo(180, 1);
  });

  it('returns null for first9DartAvg when fewer than 3 turns', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    expect(kpis.first9DartAvg).toBeNull();
  });

  it('returns zero avg for empty turns', () => {
    const kpis = computeX01KPIs([], { startingScore: 501 });
    expect(kpis.threeDartAvg).toBe(0);
    expect(kpis.bustRate).toBe(0);
    expect(kpis.tonCount).toBe(0);
  });

  it('computes consistency as the population standard deviation of turn scores', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [MISS, MISS, MISS], scoreDelta: 0 },
    ];
    // mean = 90, variance = ((90)^2 + (90)^2) / 2 = 8100, sigma = 90
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    expect(kpis.consistency).toBeCloseTo(90, 1);
  });

  it('excludes busted turns from consistency (a voided turn is not a low score)', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 180 },
      // bust: darts scored but scoreDelta forced to 0 — must not drag sigma up
      { roundNumber: 3, darts: [T20, T20, T20], scoreDelta: 0 },
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    // only the two 180s count → identical scores → sigma 0
    expect(kpis.consistency).toBeCloseTo(0, 5);
  });

  it('returns null consistency for fewer than 2 turns', () => {
    const kpis = computeX01KPIs(
      [{ roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 }],
      { startingScore: 501 },
    );
    expect(kpis.consistency).toBeNull();
  });

  it('records the remaining left after non-finishing, non-bust turns', () => {
    // 501 - 180 = 321, 321 - 180 = 141, 141 - 100 = 41 (a leave), 41 -> 1 bust
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 3, darts: [T20, T20, S20], scoreDelta: 100 },
      { roundNumber: 4, darts: [S20, S20, MISS], scoreDelta: 0 }, // bust on 41
    ];
    const kpis = computeX01KPIs(turns, { startingScore: 501 });
    // 141 is > 170? no, 141 <= 170 so it's recorded; 41 recorded; 321 > 170 not recorded
    expect(kpis.leaves['141']).toBe(1);
    expect(kpis.leaves['41']).toBe(1);
    expect(kpis.leaves['321']).toBeUndefined();
    // the bust turn leaves the score unchanged (still 41) — not recorded again as a new leave
    expect(kpis.leaves['1']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeCheckoutStats
// ---------------------------------------------------------------------------

describe('computeCheckoutStats', () => {
  it('returns zero stats for empty turns', () => {
    const stats = computeCheckoutStats([], 501);
    expect(stats.attempts).toBe(0);
    expect(stats.successes).toBe(0);
    expect(stats.byDouble).toEqual({});
  });

  it('detects a checkout attempt when remaining <= 50 and a double is thrown', () => {
    // remaining starts at 501; turns reduce it to 41 by turn 4
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 }, // 501-180=321
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 180 }, // 321-180=141
      { roundNumber: 3, darts: [T20, T20, S20], scoreDelta: 100 }, // 141-100=41
      // remaining=41, throws D16 (32) — checkout attempt
      { roundNumber: 4, darts: [S9, D16, MISS], scoreDelta: 0 },   // bust: 9+32=41 but MISS means only 2 darts scored... actually S9+D16=41, scoreDelta=41 would mean checkout
    ];
    // Let's restructure: turn 4 is a bust attempt (missed the double)
    const turnsWithAttempt: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 3, darts: [T20, T20, S20], scoreDelta: 100 },
      // remaining=41, D16 thrown (a double) but bust → scoreDelta=0
      { roundNumber: 4, darts: [D16, MISS, MISS], scoreDelta: 0 },
    ];
    const stats = computeCheckoutStats(turnsWithAttempt, 501);
    expect(stats.attempts).toBe(1);
    expect(stats.successes).toBe(0);
  });

  it('detects a successful checkout', () => {
    // remaining=40 at turn start → D20 checks out
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 }, // 501-180=321
      { roundNumber: 2, darts: [T20, T20, T20], scoreDelta: 180 }, // 321-180=141
      { roundNumber: 3, darts: [T20, T20, S20], scoreDelta: 100 }, // 141-100=41
      { roundNumber: 4, darts: [S1, D20, MISS], scoreDelta: 41 },  // 1+40=41, checkout
    ];
    const stats = computeCheckoutStats(turns, 501);
    expect(stats.attempts).toBe(1);
    expect(stats.successes).toBe(1);
    expect(stats.byDouble[20]).toEqual({ attempts: 1, successes: 1 });
  });

  it('tracks byDouble for the double used in a checkout', () => {
    // Start at 40, D20 (=40) checks out directly
    const turns: Turn[] = [
      { roundNumber: 1, darts: [D20, MISS, MISS], scoreDelta: 40 },
    ];
    const stats = computeCheckoutStats(turns, 40);
    expect(stats.byDouble[20]).toBeDefined();
    expect(stats.byDouble[20].successes).toBe(1);
  });

  it('infers an estimated attempt when on a double but no double is thrown', () => {
    // On 40, throws S20 then S20 -> bust (missed D20). No double thrown.
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, S20, MISS], scoreDelta: 0 },
    ];
    const stats = computeCheckoutStats(turns, 40);
    expect(stats.attempts).toBe(0); // ground truth unchanged
    expect(stats.successes).toBe(0);
    expect(stats.inferredAttempts).toBe(1);
    expect(stats.inferredByDouble[20]).toBe(1);
  });

  it('does not infer when a double was actually thrown (explicit attempt wins)', () => {
    // On 40, throws D16 (=32) then misses — a real double attempt, no inference
    const turns: Turn[] = [
      { roundNumber: 1, darts: [D16, MISS, MISS], scoreDelta: 0 },
    ];
    const stats = computeCheckoutStats(turns, 40);
    expect(stats.attempts).toBe(1);
    expect(stats.inferredAttempts).toBe(0);
  });

  it('counts an explicit intendedTarget chip as an exact (not inferred) attempt', () => {
    // On 36, throws S18 then S18 -> bust. Player tagged they were aiming at D18.
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S18, S18, MISS], scoreDelta: 0, intendedTarget: 18 },
    ];
    const stats = computeCheckoutStats(turns, 36);
    expect(stats.attempts).toBe(1); // exact attempt, ground-truth bucket
    expect(stats.successes).toBe(0);
    expect(stats.byDouble[18]).toEqual({ attempts: 1, successes: 0 });
    expect(stats.inferredAttempts).toBe(0); // chip overrides inference
  });

  it('returns zero inferred fields for empty turns', () => {
    const stats = computeCheckoutStats([], 501);
    expect(stats.inferredAttempts).toBe(0);
    expect(stats.inferredByDouble).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// computeCricketKPIs
// ---------------------------------------------------------------------------

describe('computeCricketKPIs', () => {
  it('returns zeros for empty turns', () => {
    const kpis = computeCricketKPIs([]);
    expect(kpis.marksPerRound).toBe(0);
  });

  it('computes marks per round correctly', () => {
    // Turn 1: T20 (3 marks) + T19 (3 marks) + T15 (3 marks) = 9 marks in 1 turn
    const turns: Turn[] = [
      {
        roundNumber: 1,
        darts: [
          { segment: 20, multiplier: 3 },
          { segment: 19, multiplier: 3 },
          T15,
        ],
        scoreDelta: 0,
      },
    ];
    const kpis = computeCricketKPIs(turns);
    expect(kpis.marksPerRound).toBeCloseTo(9, 1);
  });

  it('counts marks only for cricket segments (15-20, 25)', () => {
    const turns: Turn[] = [
      {
        roundNumber: 1,
        // S10 is not a cricket segment, T15 and S20 are
        darts: [{ segment: 10, multiplier: 1 }, T15, S20],
        scoreDelta: 0,
      },
    ];
    const kpis = computeCricketKPIs(turns);
    // 3 marks (T15) + 1 mark (S20) = 4 marks in 1 round
    expect(kpis.marksPerRound).toBeCloseTo(4, 1);
  });

  it('tracks hit rate per segment', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, S20, S20], scoreDelta: 0 },
      { roundNumber: 2, darts: [MISS, MISS, MISS], scoreDelta: 0 },
    ];
    const kpis = computeCricketKPIs(turns);
    // 20 was hit in 3/6 darts thrown
    expect(kpis.hitRateBySegment[20]).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeTargetGameKPIs
// ---------------------------------------------------------------------------

describe('computeTargetGameKPIs', () => {
  it('returns zeros for empty turns', () => {
    const kpis = computeTargetGameKPIs([], 'around-the-clock');
    expect(kpis.totalDarts).toBe(0);
    expect(kpis.overallHitRate).toBe(0);
  });

  it('computes ATC hit rate per round', () => {
    // round 1 target = segment 1; S1 hits, T20 misses
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S1, MISS, MISS], scoreDelta: 1 },
      { roundNumber: 2, darts: [MISS, MISS, MISS], scoreDelta: 0 },
    ];
    const kpis = computeTargetGameKPIs(turns, 'around-the-clock');
    expect(kpis.hitRateByRound[1].hits).toBe(1);
    expect(kpis.hitRateByRound[2].hits).toBe(0);
    expect(kpis.totalDarts).toBe(6);
  });

  it('computes Bob\'s 27 double hit rate', () => {
    // round 1 target = double-1 (segment=1, multiplier=2)
    const turns: Turn[] = [
      { roundNumber: 1, darts: [D1, MISS, MISS], scoreDelta: 2 },
      { roundNumber: 2, darts: [MISS, MISS, MISS], scoreDelta: 0 },
    ];
    const kpis = computeTargetGameKPIs(turns, 'bobs-27');
    expect(kpis.hitRateByRound[1].hits).toBe(1);
    expect(kpis.hitRateByRound[2].hits).toBe(0);
  });

  it('computes Bermuda Triangle hit rate for the fixed sequence', () => {
    // round 1 target = segment 12
    const S12: DartThrow = { segment: 12, multiplier: 1 };
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S12, MISS, MISS], scoreDelta: 12 },
    ];
    const kpis = computeTargetGameKPIs(turns, 'bermuda-triangle');
    expect(kpis.hitRateByRound[1].hits).toBe(1);
  });

  it('computes Shanghai hit rate per round target', () => {
    // round 1 target = segment 1, round 2 target = segment 2
    const S2: DartThrow = { segment: 2, multiplier: 1 };
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S1, MISS, MISS], scoreDelta: 1 },
      { roundNumber: 2, darts: [S2, S2, MISS], scoreDelta: 4 },
    ];
    const kpis = computeTargetGameKPIs(turns, 'shanghai');
    expect(kpis.hitRateByRound[1].hits).toBe(1);
    expect(kpis.hitRateByRound[2].hits).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeHighScoreKPIs
// ---------------------------------------------------------------------------

describe('computeHighScoreKPIs', () => {
  it('returns zeros for empty turns', () => {
    const kpis = computeHighScoreKPIs([]);
    expect(kpis.avgPerRound).toBe(0);
    expect(kpis.bestRound).toBe(0);
  });

  it('computes avg per round and best round', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
      { roundNumber: 2, darts: [S20, S20, S20], scoreDelta: 60 },
      { roundNumber: 3, darts: [S1, S1, S1], scoreDelta: 3 },
    ];
    const kpis = computeHighScoreKPIs(turns);
    expect(kpis.avgPerRound).toBeCloseTo((180 + 60 + 3) / 3, 1);
    expect(kpis.bestRound).toBe(180);
  });
});

// ---------------------------------------------------------------------------
// computeSessionAnalytics (integration)
// ---------------------------------------------------------------------------

describe('computeSessionAnalytics', () => {
  it('returns dart counts for all game slugs', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, S20, S20], scoreDelta: 60 },
    ];
    const result = computeSessionAnalytics('high-score', turns);
    expect(result.dartCounts['20']).toEqual({ singles: 3, doubles: 0, triples: 0 });
  });

  it('returns X01KPIs for x01 slug', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
    ];
    const result = computeSessionAnalytics('x01', turns, { startingScore: 501 });
    const kpis = result.perGameKPIs as X01KPIs;
    expect(kpis.threeDartAvg).toBeCloseTo(180, 1);
    expect(result.checkoutStats).not.toBeNull();
  });

  it('returns CricketKPIs for cricket slug', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, S19, T15], scoreDelta: 0 },
    ];
    const result = computeSessionAnalytics('cricket', turns);
    const kpis = result.perGameKPIs as CricketKPIs;
    expect(typeof kpis.marksPerRound).toBe('number');
    expect(result.checkoutStats).toBeNull();
  });

  it('returns TargetGameKPIs for around-the-clock slug', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S1, MISS, MISS], scoreDelta: 1 },
    ];
    const result = computeSessionAnalytics('around-the-clock', turns, { includeBull: false });
    const kpis = result.perGameKPIs as TargetGameKPIs;
    expect(kpis.hitRateByRound).toBeDefined();
    expect(result.checkoutStats).toBeNull();
  });

  it('returns HighScoreKPIs for high-score slug', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [T20, T20, T20], scoreDelta: 180 },
    ];
    const result = computeSessionAnalytics('high-score', turns);
    const kpis = result.perGameKPIs as HighScoreKPIs;
    expect(kpis.bestRound).toBe(180);
  });

  it('returns TargetGameKPIs for all target-based slugs without throwing', () => {
    const targetSlugs = ['baseball', 'shanghai', 'halve-it', 'bermuda-triangle', 'bobs-27'];
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S1, MISS, MISS], scoreDelta: 0 },
    ];
    for (const slug of targetSlugs) {
      expect(() => computeSessionAnalytics(slug, turns)).not.toThrow();
    }
  });

  it('handles killer slug without throwing', () => {
    const turns: Turn[] = [
      { roundNumber: 1, darts: [S20, MISS, MISS], scoreDelta: 0 },
    ];
    expect(() => computeSessionAnalytics('killer', turns)).not.toThrow();
  });
});
