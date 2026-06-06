import { describe, it, expect } from '@jest/globals';
import {
  getInitialPlayerState,
  processTurn,
  type ShanghaiPlayerState,
} from '@/lib/games/shanghai';
import type { DartThrow } from '@/types/game';

const miss: DartThrow = { segment: 0, multiplier: 0 };
const single = (s: number): DartThrow => ({ segment: s, multiplier: 1 });
const double = (s: number): DartThrow => ({ segment: s, multiplier: 2 });
const triple = (s: number): DartThrow => ({ segment: s, multiplier: 3 });

describe('shanghai – getInitialPlayerState', () => {
  it('starts at round 1 with zero score', () => {
    const state = getInitialPlayerState();
    expect(state).toEqual({ totalScore: 0, currentRound: 1 });
  });
});

describe('shanghai – processTurn', () => {
  const p0: ShanghaiPlayerState = { totalScore: 0, currentRound: 1 };
  const p1: ShanghaiPlayerState = { totalScore: 5, currentRound: 1 };

  it('scores darts that hit the target segment', () => {
    const darts = [single(1), double(1), miss];
    const result = processTurn(darts, p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(1 + 2);
    expect(result.newState.totalScore).toBe(3);
    expect(result.newState.currentRound).toBe(2);
    expect(result.isComplete).toBe(false);
    expect(result.isShanghai).toBe(false);
  });

  it('ignores darts that miss the target segment', () => {
    const darts = [single(5), single(7), miss];
    const result = processTurn(darts, p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(0);
    expect(result.newState.totalScore).toBe(0);
  });

  it('detects Shanghai (single + double + triple in one turn) → instant win', () => {
    const darts = [single(1), double(1), triple(1)];
    const result = processTurn(darts, p0, [p0, p1], 0);
    expect(result.isShanghai).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBe(0);
  });

  it('does not detect Shanghai if only single and double hit', () => {
    const darts = [single(1), double(1), miss];
    const result = processTurn(darts, p0, [p0, p1], 0);
    expect(result.isShanghai).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  it('advances currentRound after each turn', () => {
    const state: ShanghaiPlayerState = { totalScore: 0, currentRound: 3 };
    const other: ShanghaiPlayerState = { totalScore: 0, currentRound: 4 };
    const result = processTurn([miss, miss, miss], state, [state, other], 0);
    expect(result.newState.currentRound).toBe(4);
  });

  it('ends game when last player finishes round 7', () => {
    const p0done: ShanghaiPlayerState = { totalScore: 10, currentRound: 8 };
    const p1last: ShanghaiPlayerState = { totalScore: 15, currentRound: 7 };
    const darts = [single(7), miss, miss]; // p1 scores 7 → total 22
    const result = processTurn(darts, p1last, [p0done, p1last], 1);
    expect(result.isComplete).toBe(true);
    expect(result.newState.totalScore).toBe(22);
    // p1 wins with 22 vs p0's 10
    expect(result.winnerIndex).toBe(1);
  });

  it('does not end game when first player finishes round 7 (others still playing)', () => {
    const p0last: ShanghaiPlayerState = { totalScore: 10, currentRound: 7 };
    const p1still: ShanghaiPlayerState = { totalScore: 5, currentRound: 5 };
    const result = processTurn([miss, miss, miss], p0last, [p0last, p1still], 0);
    expect(result.isComplete).toBe(false);
  });

  it('correctly picks the winner with highest score after round 7', () => {
    const p0done: ShanghaiPlayerState = { totalScore: 30, currentRound: 8 };
    const p1last: ShanghaiPlayerState = { totalScore: 10, currentRound: 7 };
    const result = processTurn([miss, miss, miss], p1last, [p0done, p1last], 1);
    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBe(0); // p0 wins with 30
  });
});
