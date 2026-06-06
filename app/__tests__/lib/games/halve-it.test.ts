import { describe, it, expect } from '@jest/globals';
import {
  getInitialPlayerState,
  processTurn,
  HALVE_IT_TARGETS,
  type HalveItPlayerState,
} from '@/lib/games/halve-it';
import type { DartThrow } from '@/types/game';

const miss: DartThrow = { segment: 0, multiplier: 0 };
const single = (s: number): DartThrow => ({ segment: s, multiplier: 1 });
const double = (s: number): DartThrow => ({ segment: s, multiplier: 2 });
const triple = (s: number): DartThrow => ({ segment: s, multiplier: 3 });
const bull: DartThrow = { segment: 25, multiplier: 1 };
const doubleBull: DartThrow = { segment: 25, multiplier: 2 };

describe('halve-it – getInitialPlayerState', () => {
  it('starts at round 1 with 40 points', () => {
    expect(getInitialPlayerState()).toEqual({ score: 40, currentRound: 1 });
  });
});

describe('halve-it – HALVE_IT_TARGETS', () => {
  it('has 9 targets', () => {
    expect(HALVE_IT_TARGETS).toHaveLength(9);
  });

  it('starts at 20, ends with doubles and triples', () => {
    expect(HALVE_IT_TARGETS[0]).toBe(20);
    expect(HALVE_IT_TARGETS[7]).toBe('doubles');
    expect(HALVE_IT_TARGETS[8]).toBe('triples');
  });
});

describe('halve-it – processTurn (number targets)', () => {
  const p0: HalveItPlayerState = { score: 40, currentRound: 1 };
  const p1: HalveItPlayerState = { score: 40, currentRound: 1 };

  it('adds score when any dart hits the target segment', () => {
    // Round 1 target = 20; single(20)=20, double(20)=40
    const result = processTurn([single(20), double(20), miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(20 + 40);
    expect(result.newState.score).toBe(40 + 60);
    expect(result.halved).toBe(false);
  });

  it('halves score when no dart hits the target segment', () => {
    const result = processTurn([miss, single(5), triple(3)], p0, [p0, p1], 0);
    expect(result.halved).toBe(true);
    expect(result.newState.score).toBe(20); // floor(40 / 2)
    expect(result.scoreDelta).toBe(-20); // lost 20
  });

  it('halved score is floored and never goes below 1', () => {
    const p: HalveItPlayerState = { score: 1, currentRound: 1 };
    const result = processTurn([miss, miss, miss], p, [p, p1], 0);
    expect(result.newState.score).toBe(1);
  });

  it('advances round after each turn', () => {
    const result = processTurn([miss, miss, miss], p0, [p0, p1], 0);
    expect(result.newState.currentRound).toBe(2);
    expect(result.isComplete).toBe(false);
  });
});

describe('halve-it – processTurn (bull round)', () => {
  // Round 7 = Bull (target index 6)
  const p0: HalveItPlayerState = { score: 100, currentRound: 7 };
  const p1: HalveItPlayerState = { score: 100, currentRound: 7 };

  it('bull and double bull count as hits', () => {
    const result = processTurn([bull, doubleBull, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(25 + 50);
    expect(result.halved).toBe(false);
  });

  it('missing the bull halves score', () => {
    const result = processTurn([single(20), miss, miss], p0, [p0, p1], 0);
    expect(result.halved).toBe(true);
    expect(result.newState.score).toBe(50);
  });
});

describe('halve-it – processTurn (doubles round)', () => {
  // Round 8 = doubles (target index 7)
  const p0: HalveItPlayerState = { score: 100, currentRound: 8 };
  const p1: HalveItPlayerState = { score: 100, currentRound: 8 };

  it('any double counts as a hit and scores segment × 2', () => {
    const result = processTurn([double(15), miss, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(30);
    expect(result.halved).toBe(false);
  });

  it('singles and triples do not count as doubles', () => {
    const result = processTurn([single(20), triple(20), miss], p0, [p0, p1], 0);
    expect(result.halved).toBe(true);
  });
});

describe('halve-it – processTurn (triples round)', () => {
  // Round 9 = triples (target index 8)
  const p0: HalveItPlayerState = { score: 100, currentRound: 9 };
  const p1: HalveItPlayerState = { score: 100, currentRound: 9 };

  it('any triple counts as a hit and scores segment × 3', () => {
    const result = processTurn([triple(10), miss, miss], p0, [p0, p1], 0);
    expect(result.scoreDelta).toBe(30);
    expect(result.halved).toBe(false);
  });

  it('doubles and singles do not count as triples', () => {
    const result = processTurn([double(20), single(20), miss], p0, [p0, p1], 0);
    expect(result.halved).toBe(true);
  });
});

describe('halve-it – game completion', () => {
  it('ends game when last player completes round 9', () => {
    const p0done: HalveItPlayerState = { score: 200, currentRound: 10 };
    const p1last: HalveItPlayerState = { score: 80, currentRound: 9 };
    const result = processTurn([triple(10), miss, miss], p1last, [p0done, p1last], 1);
    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBe(0); // p0 has 200 > p1's 110
  });

  it('does not end game if not all players done', () => {
    const p0: HalveItPlayerState = { score: 200, currentRound: 9 };
    const p1: HalveItPlayerState = { score: 80, currentRound: 5 };
    const result = processTurn([miss, miss, miss], p0, [p0, p1], 0);
    expect(result.isComplete).toBe(false);
  });
});
