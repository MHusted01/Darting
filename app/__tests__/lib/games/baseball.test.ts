import { describe, it, expect } from '@jest/globals';
import {
  getInitialPlayerState,
  processTurn,
  type BaseballPlayerState,
} from '@/lib/games/baseball';
import type { DartThrow } from '@/types/game';

const miss: DartThrow = { segment: 0, multiplier: 0 };
const single = (s: number): DartThrow => ({ segment: s, multiplier: 1 });
const double = (s: number): DartThrow => ({ segment: s, multiplier: 2 });
const triple = (s: number): DartThrow => ({ segment: s, multiplier: 3 });

describe('baseball – getInitialPlayerState', () => {
  it('starts at inning 1 with zero runs', () => {
    expect(getInitialPlayerState()).toEqual({ totalRuns: 0, currentInning: 1 });
  });
});

describe('baseball – processTurn', () => {
  const p0: BaseballPlayerState = { totalRuns: 0, currentInning: 1 };
  const p1: BaseballPlayerState = { totalRuns: 0, currentInning: 1 };

  it('single on target segment scores 1 run', () => {
    const result = processTurn([single(1), miss, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(1);
    expect(result.newState.totalRuns).toBe(1);
  });

  it('double on target scores 2 runs', () => {
    const result = processTurn([double(1), miss, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(2);
  });

  it('triple on target scores 3 runs', () => {
    const result = processTurn([triple(1), miss, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(3);
  });

  it('darts on wrong segment score 0 runs', () => {
    const result = processTurn([single(5), double(7), miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(0);
  });

  it('advances inning after each turn', () => {
    const result = processTurn([miss, miss, miss], p0, [p0, p1], 0);
    expect(result.newState.currentInning).toBe(2);
    expect(result.isComplete).toBe(false);
  });

  it('ends game when last player completes inning 9', () => {
    const p0done: BaseballPlayerState = { totalRuns: 5, currentInning: 10 };
    const p1last: BaseballPlayerState = { totalRuns: 3, currentInning: 9 };
    const result = processTurn([single(9), miss, miss], p1last, [p0done, p1last], 1);
    expect(result.isComplete).toBe(true);
    expect(result.newState.totalRuns).toBe(4);
    expect(result.winnerIndex).toBe(0); // p0 wins with 5 runs
  });

  it('does not end game if not all players done', () => {
    const p0: BaseballPlayerState = { totalRuns: 5, currentInning: 9 };
    const p1: BaseballPlayerState = { totalRuns: 3, currentInning: 7 };
    const result = processTurn([single(9), miss, miss], p0, [p0, p1], 0);
    expect(result.isComplete).toBe(false);
  });
});
