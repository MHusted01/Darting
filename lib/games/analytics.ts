import type { DartThrow } from '@/types/game';
import { getMarksFromDart } from '@/lib/games/cricket';
import { BERMUDA_TRIANGLE_TARGETS } from '@/lib/games/bermuda-triangle';
import { HALVE_IT_TARGETS, type HalveItTarget } from '@/lib/games/halve-it';

export type SessionContext = 'casual' | 'tournament' | 'practice' | 'realtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DartCounts {
  [segment: string]: { singles: number; doubles: number; triples: number };
}

export interface X01KPIs {
  threeDartAvg: number;
  first9DartAvg: number | null;
  bustRate: number;
  tonCount: number;
  ton40Count: number;
  ton80Count: number;
  highestCheckout: number | null;
  checkoutRate: number;
}

export interface CricketKPIs {
  marksPerRound: number;
  hitRateBySegment: Record<number, number>;
}

export interface TargetGameKPIs {
  hitRateByRound: Record<number, { darts: number; hits: number; rate: number }>;
  totalDarts: number;
  totalHits: number;
  overallHitRate: number;
}

export interface HighScoreKPIs {
  avgPerRound: number;
  bestRound: number;
}

export interface CheckoutStats {
  attempts: number;
  successes: number;
  byDouble: Record<number, { attempts: number; successes: number }>;
}

export interface PlayerAnalytics {
  dartCounts: DartCounts;
  perGameKPIs: X01KPIs | CricketKPIs | TargetGameKPIs | HighScoreKPIs | Record<string, never>;
  checkoutStats: CheckoutStats | null;
}

type Turn = { roundNumber: number; darts: DartThrow[]; scoreDelta: number };

// ---------------------------------------------------------------------------
// computeDartCounts
// ---------------------------------------------------------------------------

export function computeDartCounts(turns: Turn[]): DartCounts {
  const counts: DartCounts = {};

  for (const turn of turns) {
    for (const dart of turn.darts) {
      if (dart.segment === 0 || dart.multiplier === 0) continue;

      const key = String(dart.segment);
      if (!counts[key]) {
        counts[key] = { singles: 0, doubles: 0, triples: 0 };
      }

      if (dart.multiplier === 1) counts[key].singles++;
      else if (dart.multiplier === 2) counts[key].doubles++;
      else if (dart.multiplier === 3) counts[key].triples++;
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// computeX01KPIs
// ---------------------------------------------------------------------------

export function computeX01KPIs(
  turns: Turn[],
  config: { startingScore: 501 | 301 },
): X01KPIs {
  if (turns.length === 0) {
    return {
      threeDartAvg: 0,
      first9DartAvg: null,
      bustRate: 0,
      tonCount: 0,
      ton40Count: 0,
      ton80Count: 0,
      highestCheckout: null,
      checkoutRate: 0,
    };
  }

  let totalDarts = 0;
  let totalScored = 0;
  let bustCount = 0;
  let tonCount = 0;
  let ton40Count = 0;
  let ton80Count = 0;
  let highestCheckout: number | null = null;
  let remaining = config.startingScore;
  let checkoutAttempts = 0;
  let checkoutSuccesses = 0;

  // First 3 turns for first-9-dart avg
  const first3Turns = turns.slice(0, 3);
  let first9DartAvg: number | null = null;
  if (first3Turns.length === 3) {
    const f9Darts = first3Turns.reduce((s, t) => s + t.darts.length, 0);
    const f9Scored = first3Turns.reduce((s, t) => s + t.scoreDelta, 0);
    first9DartAvg = f9Darts > 0 ? (f9Scored / f9Darts) * 3 : 0;
  }

  for (const turn of turns) {
    const dartCount = turn.darts.length;
    totalDarts += dartCount;

    const isBust =
      turn.scoreDelta === 0 &&
      turn.darts.some((d) => d.segment > 0 && d.multiplier > 0);

    // remainingBeforeTurn must be captured before we update `remaining`
    const remainingBeforeTurn = remaining;

    if (isBust) {
      bustCount++;
    } else {
      totalScored += turn.scoreDelta;

      if (turn.scoreDelta >= 180) ton80Count++;
      else if (turn.scoreDelta >= 140) ton40Count++;
      else if (turn.scoreDelta >= 100) tonCount++;

      remaining -= turn.scoreDelta;

      // Checkout: remaining hit exactly 0 AND this was a checkout-range turn
      if (remaining === 0 && turn.scoreDelta > 0 && remainingBeforeTurn <= 170) {
        checkoutSuccesses++;
        highestCheckout =
          highestCheckout === null
            ? turn.scoreDelta
            : Math.max(highestCheckout, turn.scoreDelta);
      }
    }

    // Checkout attempt: player was in checkout range (≤170) and threw a double
    if (remainingBeforeTurn <= 170 && turn.darts.some((d) => d.multiplier === 2 && d.segment > 0)) {
      checkoutAttempts++;
    }
  }

  const threeDartAvg =
    totalDarts > 0 ? (totalScored / totalDarts) * 3 : 0;
  const bustRate = turns.length > 0 ? bustCount / turns.length : 0;
  const checkoutRate =
    checkoutAttempts > 0 ? checkoutSuccesses / checkoutAttempts : 0;

  return {
    threeDartAvg,
    first9DartAvg,
    bustRate,
    tonCount,
    ton40Count,
    ton80Count,
    highestCheckout,
    checkoutRate,
  };
}

// ---------------------------------------------------------------------------
// computeCheckoutStats
// ---------------------------------------------------------------------------

export function computeCheckoutStats(
  turns: Turn[],
  startingScore: number,
): CheckoutStats {
  const byDouble: Record<number, { attempts: number; successes: number }> = {};
  let attempts = 0;
  let successes = 0;
  let remaining = startingScore;

  for (const turn of turns) {
    const isBust =
      turn.scoreDelta === 0 &&
      turn.darts.some((d) => d.segment > 0 && d.multiplier > 0);

    const remainingBeforeTurn = remaining;

    if (!isBust) {
      remaining -= turn.scoreDelta;
    }

    const hasDouble = turn.darts.some((d) => d.multiplier === 2 && d.segment > 0);

    if (remainingBeforeTurn <= 170 && hasDouble) {
      attempts++;

      // For a successful checkout, find which double completed the score
      const isCheckout = !isBust && remaining === 0;
      if (isCheckout) {
        successes++;
        const checkoutDouble = findCheckoutDouble(turn.darts, remainingBeforeTurn);
        if (checkoutDouble !== null) {
          if (!byDouble[checkoutDouble]) {
            byDouble[checkoutDouble] = { attempts: 0, successes: 0 };
          }
          byDouble[checkoutDouble].attempts++;
          byDouble[checkoutDouble].successes++;
        }
      } else {
        // Attempt without success: track by intended double (clean even remaining)
        // Best-effort: only attribute to byDouble when the remaining is a clean double finish
        const intendedDouble =
          remainingBeforeTurn === 50
            ? 25
            : remainingBeforeTurn % 2 === 0 && remainingBeforeTurn <= 40
              ? remainingBeforeTurn / 2
              : null; // multi-dart finishes — can't reliably infer intended double
        if (intendedDouble !== null) {
          if (!byDouble[intendedDouble]) {
            byDouble[intendedDouble] = { attempts: 0, successes: 0 };
          }
          byDouble[intendedDouble].attempts++;
        }
      }
    }
  }

  return { attempts, successes, byDouble };
}

function findCheckoutDouble(darts: DartThrow[], startRemaining: number): number | null {
  let r = startRemaining;
  for (const dart of darts) {
    const score = dart.segment * dart.multiplier;
    const next = r - score;
    if (next === 0 && dart.multiplier === 2) {
      return dart.segment;
    }
    if (next < 0 || next === 1) break;
    r = next;
  }
  return null;
}

// ---------------------------------------------------------------------------
// computeCricketKPIs
// ---------------------------------------------------------------------------

export function computeCricketKPIs(turns: Turn[]): CricketKPIs {
  if (turns.length === 0) {
    return { marksPerRound: 0, hitRateBySegment: {} };
  }

  let totalMarks = 0;
  const segmentDarts: Record<number, { thrown: number; hit: number }> = {};

  for (const turn of turns) {
    for (const dart of turn.darts) {
      const { segment, marks } = getMarksFromDart(dart);

      if (segment !== null) {
        if (!segmentDarts[segment]) segmentDarts[segment] = { thrown: 0, hit: 0 };
        segmentDarts[segment].thrown++;
        if (marks > 0) {
          segmentDarts[segment].hit++;
          totalMarks += marks;
        }
      }
    }
  }

  const marksPerRound = totalMarks / turns.length;

  const hitRateBySegment: Record<number, number> = {};
  for (const [seg, { thrown, hit }] of Object.entries(segmentDarts)) {
    hitRateBySegment[Number(seg)] = thrown > 0 ? hit / thrown : 0;
  }

  return { marksPerRound, hitRateBySegment };
}

// ---------------------------------------------------------------------------
// Target resolver — maps round number → intended target
// ---------------------------------------------------------------------------

type AnalyticsTarget =
  | { segment: number; multiplier?: number }
  | { special: 'doubles' | 'triples' | 'bull' };

function isTargetHit(dart: DartThrow, target: AnalyticsTarget): boolean {
  if ('special' in target) {
    if (target.special === 'bull') return dart.segment === 25 && dart.multiplier > 0;
    if (target.special === 'doubles') return dart.multiplier === 2;
    if (target.special === 'triples') return dart.multiplier === 3;
    return false;
  }
  if (dart.segment !== target.segment) return false;
  if (dart.multiplier === 0) return false;
  if (target.multiplier !== undefined) return dart.multiplier === target.multiplier;
  return true;
}

function getTargetForRound(gameSlug: string, round: number): AnalyticsTarget | null {
  switch (gameSlug) {
    case 'around-the-clock':
      return round <= 21 ? { segment: round <= 20 ? round : 25 } : null;
    case 'shanghai':
      return round <= 7 ? { segment: round } : null;
    case 'baseball':
      return round <= 9 ? { segment: round } : null;
    case 'bobs-27':
      return round <= 20 ? { segment: round, multiplier: 2 } : null;
    case 'bermuda-triangle': {
      const t = BERMUDA_TRIANGLE_TARGETS[round - 1];
      return t !== undefined ? { segment: t } : null;
    }
    case 'halve-it': {
      const ht: HalveItTarget | undefined = HALVE_IT_TARGETS[round - 1];
      if (ht === undefined) return null;
      if (ht === 'bull') return { special: 'bull' };
      if (ht === 'doubles') return { special: 'doubles' };
      if (ht === 'triples') return { special: 'triples' };
      return { segment: ht as number };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// computeTargetGameKPIs
// ---------------------------------------------------------------------------

export function computeTargetGameKPIs(
  turns: Turn[],
  gameSlug: string,
): TargetGameKPIs {
  const hitRateByRound: Record<number, { darts: number; hits: number; rate: number }> = {};
  let totalDarts = 0;
  let totalHits = 0;

  for (const turn of turns) {
    const target = getTargetForRound(gameSlug, turn.roundNumber);
    const darts = turn.darts.length;
    const hits = target
      ? turn.darts.filter((d) => isTargetHit(d, target)).length
      : 0;

    hitRateByRound[turn.roundNumber] = {
      darts,
      hits,
      rate: darts > 0 ? hits / darts : 0,
    };

    totalDarts += darts;
    totalHits += hits;
  }

  return {
    hitRateByRound,
    totalDarts,
    totalHits,
    overallHitRate: totalDarts > 0 ? totalHits / totalDarts : 0,
  };
}

// ---------------------------------------------------------------------------
// computeHighScoreKPIs
// ---------------------------------------------------------------------------

export function computeHighScoreKPIs(turns: Turn[]): HighScoreKPIs {
  if (turns.length === 0) {
    return { avgPerRound: 0, bestRound: 0 };
  }

  const total = turns.reduce((s, t) => s + t.scoreDelta, 0);
  const best = Math.max(...turns.map((t) => t.scoreDelta));

  return {
    avgPerRound: total / turns.length,
    bestRound: best,
  };
}

// ---------------------------------------------------------------------------
// computeSessionAnalytics — dispatch by game slug
// ---------------------------------------------------------------------------

const TARGET_GAME_SLUGS = new Set([
  'around-the-clock',
  'shanghai',
  'baseball',
  'bobs-27',
  'bermuda-triangle',
  'halve-it',
]);

export function computeSessionAnalytics(
  gameSlug: string,
  turns: Turn[],
  config?: unknown,
): PlayerAnalytics {
  const dartCounts = computeDartCounts(turns);

  let perGameKPIs: PlayerAnalytics['perGameKPIs'];
  let checkoutStats: CheckoutStats | null = null;

  if (gameSlug === 'x01') {
    const x01Config = (config as { startingScore: 501 | 301 } | undefined) ?? {
      startingScore: 501 as const,
    };
    perGameKPIs = computeX01KPIs(turns, x01Config);
    checkoutStats = computeCheckoutStats(turns, x01Config.startingScore);
  } else if (gameSlug === 'cricket') {
    perGameKPIs = computeCricketKPIs(turns);
  } else if (TARGET_GAME_SLUGS.has(gameSlug)) {
    perGameKPIs = computeTargetGameKPIs(turns, gameSlug);
  } else if (gameSlug === 'high-score') {
    perGameKPIs = computeHighScoreKPIs(turns);
  } else {
    perGameKPIs = {};
  }

  return { dartCounts, perGameKPIs, checkoutStats };
}

