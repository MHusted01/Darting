import { describe, it, expect } from '@jest/globals';
import {
  getInitialPlayerState,
  processTurn,
  type Bobs27PlayerState,
} from '@/lib/games/bobs-27';
import type { DartThrow } from '@/types/game';

const miss: DartThrow = { segment: 0, multiplier: 0 };
const single = (s: number): DartThrow => ({ segment: s, multiplier: 1 });
const double = (s: number): DartThrow => ({ segment: s, multiplier: 2 });

describe('bobs-27 – getInitialPlayerState', () => {
  it('starts at round 1 with 27 points, not eliminated', () => {
    expect(getInitialPlayerState()).toEqual({
      score: 27,
      currentRound: 1,
      eliminated: false,
    });
  });
});

describe('bobs-27 – processTurn', () => {
  const p0: Bobs27PlayerState = { score: 27, currentRound: 1, eliminated: false };
  const p1: Bobs27PlayerState = { score: 27, currentRound: 1, eliminated: false };

  it('hitting double-N adds 2N per dart', () => {
    // Round 1 = target double-1; hit 2 doubles → +2 each = +4
    const result = processTurn([double(1), double(1), miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(4);
    expect(result.newState.score).toBe(31);
    expect(result.newState.eliminated).toBe(false);
  });

  it('missing all doubles subtracts 2N', () => {
    // Round 1 = double-1; miss → -2
    const result = processTurn([miss, single(1), miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(-2);
    expect(result.newState.score).toBe(25);
  });

  it('uses the round number as the target (round 5 = double-5)', () => {
    const p: Bobs27PlayerState = { score: 27, currentRound: 5, eliminated: false };
    const result = processTurn([double(5), miss, miss], p, [p, p1], 0);
    expect(result.scoreDelta).toBe(10); // 2 × 5 = 10
    expect(result.newState.score).toBe(37);
  });

  it('advances round after each turn', () => {
    const result = processTurn([miss, miss, miss], p0, [p0, p1], 0);
    expect(result.newState.currentRound).toBe(2);
    expect(result.isComplete).toBe(false);
  });

  it('eliminates player when score drops to 0 or below', () => {
    const p: Bobs27PlayerState = { score: 2, currentRound: 3, eliminated: false };
    // Round 3 = double-3; miss → -6 → score would be -4 → eliminated at 0
    const result = processTurn([miss, miss, miss], p, [p, p1], 0);
    expect(result.newState.eliminated).toBe(true);
    expect(result.newState.score).toBe(0);
  });

  it('eliminated player stays eliminated and scores 0 each turn', () => {
    const p: Bobs27PlayerState = { score: 0, currentRound: 5, eliminated: true };
    const result = processTurn([double(5), double(5), double(5)], p, [p, p1], 0);
    expect(result.newState.eliminated).toBe(true);
    expect(result.scoreDelta).toBe(0);
    expect(result.newState.score).toBe(0);
  });

  it('ends game when last player finishes round 20', () => {
    const p0done: Bobs27PlayerState = { score: 100, currentRound: 21, eliminated: false };
    const p1last: Bobs27PlayerState = { score: 50, currentRound: 20, eliminated: false };
    const result = processTurn([double(20), miss, miss], p1last, [p0done, p1last], 1);
    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBe(0); // p0 100 > p1 90
  });

  it('does not end game if not all players done', () => {
    const p0: Bobs27PlayerState = { score: 100, currentRound: 20, eliminated: false };
    const p1: Bobs27PlayerState = { score: 50, currentRound: 10, eliminated: false };
    const result = processTurn([miss, miss, miss], p0, [p0, p1], 0);
    expect(result.isComplete).toBe(false);
  });
});
