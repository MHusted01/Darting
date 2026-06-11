import type { DartThrow } from '@/types/game';
import { adjacentSegments } from '@/lib/dartboard';

/**
 * Checkout intended-target inference.
 *
 * When a player is "on a double" (remaining is a direct double-out) the only
 * sensible target is that finishing double. If they miss it but land nearby
 * (same wedge, adjacent wedge, adjacent double ring) we can infer they were
 * *aiming* at the double — an estimated checkout attempt. This upgrades
 * checkout stats from "doubles thrown" to "doubles aimed at" without any
 * extra input from the player.
 *
 * Inference only ever adds *attempts*, never successes. The explicit rule
 * (a double thrown in checkout range) remains the ground truth.
 */

/** Highest checkout that has a standard finish (excludes bogey numbers). */
const MAX_CHECKOUT = 170;

/**
 * The finishing double for a remaining score the player is directly on:
 * an even number ≤ 40 finishes on its half, 50 finishes on the bull.
 * Returns null when the remaining is not a direct double-out.
 */
export function finishingDouble(remaining: number): number | null {
  if (remaining === 50) return 25; // bull
  if (remaining >= 2 && remaining <= 40 && remaining % 2 === 0) {
    return remaining / 2;
  }
  return null;
}

/**
 * True when `dart` looks like a missed attempt at the double on `intendedDouble`:
 * the same-wedge single, an adjacent-wedge single or double, or — for the bull —
 * the single bull. The double itself, trebles, far wedges and misses do not count.
 */
export function isNearMiss(intendedDouble: number, dart: DartThrow): boolean {
  if (dart.segment === 0 || dart.multiplier === 0) return false; // a miss

  // The double itself is a hit, not a near miss.
  if (dart.segment === intendedDouble && dart.multiplier === 2) return false;

  if (intendedDouble === 25) {
    // Bull finish: the single bull (25) is the only meaningful near miss.
    return dart.segment === 25;
  }

  // Same wedge, missed the double ring (landed the single of the number).
  if (dart.segment === intendedDouble && dart.multiplier === 1) return true;

  // Adjacent wedge — single or double ring counts as a near miss.
  const neighbours = adjacentSegments(intendedDouble);
  if (neighbours.includes(dart.segment) && (dart.multiplier === 1 || dart.multiplier === 2)) {
    return true;
  }

  return false;
}

/**
 * Whether a just-finished turn is a candidate for the optional "tag intended
 * checkout target" chip. Eligibility is intentionally broad: any checkout-range
 * turn (remaining ≤ {@link MAX_CHECKOUT}) that did not throw a double — so the
 * player can record exact intent even when {@link inferIntendedDouble} cannot
 * (e.g. they left a treble-setup and never reached an on-a-double state). A turn
 * that threw a double already has a ground-truth attempt and is not offered.
 */
export function isMissedCheckoutCandidate(
  remaining: number,
  darts: DartThrow[],
): boolean {
  if (remaining < 2 || remaining > MAX_CHECKOUT) return false;
  return !darts.some((d) => d.multiplier === 2 && d.segment > 0);
}

/**
 * Walk a turn's darts and, the first time the player is on a double and throws
 * a near miss, return the double they were aiming at. Returns null if they were
 * never on a double or never threw a near miss. Shared by the analytics
 * dart-walk and the in-play "missed target?" chip so the logic lives in one place.
 */
export function inferIntendedDouble(
  darts: DartThrow[],
  startRemaining: number,
): number | null {
  if (startRemaining > MAX_CHECKOUT) return null;
  let remaining = startRemaining;

  for (const dart of darts) {
    const intended = finishingDouble(remaining);
    if (intended !== null && isNearMiss(intended, dart)) {
      return intended;
    }

    const score = dart.segment * dart.multiplier;
    const next = remaining - score;
    if (next < 0 || next === 1 || next === 0) break; // bust or finished
    remaining = next;
  }

  return null;
}
