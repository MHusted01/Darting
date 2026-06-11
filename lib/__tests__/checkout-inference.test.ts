import { describe, expect, it } from '@jest/globals';
import {
  finishingDouble,
  isNearMiss,
  inferIntendedDouble,
  isMissedCheckoutCandidate,
} from '@/lib/checkout-inference';

type DartThrow = { segment: number; multiplier: number };

const s = (segment: number): DartThrow => ({ segment, multiplier: 1 });
const d = (segment: number): DartThrow => ({ segment, multiplier: 2 });
const t = (segment: number): DartThrow => ({ segment, multiplier: 3 });
const MISS: DartThrow = { segment: 0, multiplier: 0 };

describe('finishingDouble', () => {
  it('maps an on-a-double remaining to its double segment', () => {
    expect(finishingDouble(20)).toBe(10);
    expect(finishingDouble(40)).toBe(20);
    expect(finishingDouble(32)).toBe(16);
    expect(finishingDouble(2)).toBe(1);
  });

  it('maps 50 to the bull (25)', () => {
    expect(finishingDouble(50)).toBe(25);
  });

  it('returns null for odd remainings, values over 40, and bogey numbers', () => {
    expect(finishingDouble(41)).toBeNull();
    expect(finishingDouble(60)).toBeNull();
    expect(finishingDouble(169)).toBeNull();
    expect(finishingDouble(1)).toBeNull();
    expect(finishingDouble(0)).toBeNull();
  });
});

describe('isNearMiss', () => {
  it('counts the same-wedge single as a near miss (D10 → S10)', () => {
    expect(isNearMiss(10, s(10))).toBe(true);
  });

  it('counts adjacent-wedge singles as near misses (D10 → S6/S15)', () => {
    expect(isNearMiss(10, s(6))).toBe(true);
    expect(isNearMiss(10, s(15))).toBe(true);
  });

  it('counts adjacent-ring doubles as near misses (D10 → D6/D15)', () => {
    expect(isNearMiss(10, d(6))).toBe(true);
    expect(isNearMiss(10, d(15))).toBe(true);
  });

  it('does not count the double itself, triples, far segments, or misses', () => {
    expect(isNearMiss(10, d(10))).toBe(false); // the hit, not a miss
    expect(isNearMiss(10, t(10))).toBe(false); // treble is not a double attempt
    expect(isNearMiss(10, s(1))).toBe(false); // far wedge
    expect(isNearMiss(10, MISS)).toBe(false);
  });

  it('treats single bull as a near miss of the bull finish', () => {
    expect(isNearMiss(25, s(25))).toBe(true);
    expect(isNearMiss(25, d(25))).toBe(false); // the hit
    expect(isNearMiss(25, s(5))).toBe(false);
  });
});

describe('inferIntendedDouble', () => {
  it('infers the intended double from a missed-double bust (40: S20, S20)', () => {
    expect(inferIntendedDouble([s(20), s(20)], 40)).toBe(20);
  });

  it('infers across a setup dart (60: S20 leaves 40, then near-miss of D20)', () => {
    expect(inferIntendedDouble([s(20), s(20), s(20)], 60)).toBe(20);
  });

  it('returns null when the player never reaches an on-a-double state', () => {
    expect(inferIntendedDouble([s(20), s(1)], 41)).toBeNull();
  });

  it('returns null when the on-a-double dart is nowhere near the double', () => {
    expect(inferIntendedDouble([s(3)], 40)).toBeNull(); // S3 not adjacent to 20
  });
});

describe('isMissedCheckoutCandidate', () => {
  it('is eligible broadly across the whole checkout range with no double thrown', () => {
    // Direct double-out where inference would also apply
    expect(isMissedCheckoutCandidate(40, [s(20), s(20)])).toBe(true);
    // High checkouts where the player was likely on a treble/setup first and
    // inference cannot pin a double — still eligible so exact intent can be logged
    expect(isMissedCheckoutCandidate(167, [t(20), t(19), s(20)])).toBe(true);
    expect(isMissedCheckoutCandidate(170, [t(20), t(20), s(10)])).toBe(true);
    expect(isMissedCheckoutCandidate(141, [t(20), t(19), s(12)])).toBe(true);
  });

  it('is not eligible when a double was thrown (ground-truth attempt exists)', () => {
    expect(isMissedCheckoutCandidate(40, [d(16), MISS])).toBe(false);
  });

  it('is not eligible outside the checkout range', () => {
    expect(isMissedCheckoutCandidate(180, [t(20), t(20), t(20)])).toBe(false);
    expect(isMissedCheckoutCandidate(1, [MISS])).toBe(false);
  });
});
