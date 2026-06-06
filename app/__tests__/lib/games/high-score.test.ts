import { describe, it, expect } from '@jest/globals';
import {
  getInitialPlayerState,
  processTurn,
  type HighScorePlayerState,
} from '@/lib/games/high-score';
import type { DartThrow } from '@/types/game';

const miss: DartThrow = { segment: 0, multiplier: 0 };
const single = (s: number): DartThrow => ({ segment: s, multiplier: 1 });
const double = (s: number): DartThrow => ({ segment: s, multiplier: 2 });
const triple = (s: number): DartThrow => ({ segment: s, multiplier: 3 });
const bull: DartThrow = { segment: 25, multiplier: 1 };
const doubleBull: DartThrow = { segment: 25, multiplier: 2 };

describe('high-score – getInitialPlayerState', () => {
  it('starts at round 1 with zero score', () => {
    expect(getInitialPlayerState()).toEqual({ totalScore: 0, currentRound: 1 });
  });
});

describe('high-score – processTurn', () => {
  const p0: HighScorePlayerState = { totalScore: 0, currentRound: 1 };
  const p1: HighScorePlayerState = { totalScore: 0, currentRound: 1 };

  it('scores all darts by segment × multiplier', () => {
    const result = processTurn([triple(20), double(20), single(20)], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(60 + 40 + 20);
    expect(result.newState.totalScore).toBe(120);
  });

  it('misses score 0', () => {
    const result = processTurn([miss, miss, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(0);
  });

  it('bull scores 25, double bull 50', () => {
    const result = processTurn([bull, doubleBull, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(25 + 50);
  });

  it('advances round after each turn', () => {
    const result = processTurn([miss, miss, miss], p0, [p0, p1], 0);
    expect(result.newState.currentRound).toBe(2);
    expect(result.isComplete).toBe(false);
  });

  it('ends game when last player finishes round 10', () => {
    const p0done: HighScorePlayerState = { totalScore: 200, currentRound: 11 };
    const p1last: HighScorePlayerState = { totalScore: 100, currentRound: 10 };
    const result = processTurn([triple(20), triple(20), triple(20)], p1last, [p0done, p1last], 1);
    expect(result.isComplete).toBe(true);
    expect(result.newState.totalScore).toBe(280);
    expect(result.winnerIndex).toBe(1); // p1 wins with 280 vs p0's 200
  });
});
