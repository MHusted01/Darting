/**
 * A single dart throw recorded during gameplay.
 *
 * - `segment`: the board number hit (1–20, 25 for bull, 0 for a miss)
 * - `multiplier`: 1 = single, 2 = double, 3 = triple, 0 = miss
 *
 * Score for a throw = segment × multiplier.
 */
export interface DartThrow {
  segment: number;
  multiplier: number;
}
