/**
 * Physical dartboard geometry.
 *
 * Used by checkout intended-target inference to decide whether a thrown dart
 * landed "near" the double a player was aiming at (same wedge, adjacent wedge).
 */

/** Wedge numbers in clockwise order starting at 20 (top of the board). */
export const BOARD_SEQUENCE = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

const SEGMENT_COUNT = BOARD_SEQUENCE.length;

/**
 * The two wedges physically adjacent to `segment` on the board.
 * Returns an empty array for the bull, a miss, or any out-of-range number.
 */
export function adjacentSegments(segment: number): number[] {
  const idx = BOARD_SEQUENCE.indexOf(segment as (typeof BOARD_SEQUENCE)[number]);
  if (idx === -1) return [];
  const prev = BOARD_SEQUENCE[(idx - 1 + SEGMENT_COUNT) % SEGMENT_COUNT];
  const next = BOARD_SEQUENCE[(idx + 1) % SEGMENT_COUNT];
  return [prev, next];
}
