import { describe, expect, it } from '@jest/globals';
import {
  getInitialPlayerState,
  processTurn,
  type X01Config,
  type X01PlayerState,
} from '@/lib/games/x01';
import type { DartThrow } from '@/types/game';

const config501: X01Config = { startingScore: 501 };
const config301: X01Config = { startingScore: 301 };

function dart(segment: number, multiplier: number): DartThrow {
  return { segment, multiplier };
}

const miss = dart(0, 0);
const single = (n: number) => dart(n, 1);
const double = (n: number) => dart(n, 2);
const triple = (n: number) => dart(n, 3);
const singleBull = dart(25, 1);
const doubleBull = dart(25, 2);

// ---------------------------------------------------------------------------
// getInitialPlayerState
// ---------------------------------------------------------------------------

describe('getInitialPlayerState', () => {
  it('returns remaining = 501 for 501 config', () => {
    expect(getInitialPlayerState(config501)).toEqual({ remaining: 501 });
  });

  it('returns remaining = 301 for 301 config', () => {
    expect(getInitialPlayerState(config301)).toEqual({ remaining: 301 });
  });
});

// ---------------------------------------------------------------------------
// Normal scoring (no checkout, no bust)
// ---------------------------------------------------------------------------

describe('processTurn — normal scoring', () => {
  it('reduces remaining by segment × multiplier for each dart', () => {
    const state: X01PlayerState = { remaining: 501 };
    const result = processTurn([single(20), triple(20), double(20)], state, config501);
    // 20 + 60 + 40 = 120
    expect(result.newState.remaining).toBe(381);
    expect(result.scoreDelta).toBe(120);
    expect(result.isComplete).toBe(false);
    expect(result.isBust).toBe(false);
  });

  it('counts a miss (0,0) as zero score', () => {
    const state: X01PlayerState = { remaining: 501 };
    const result = processTurn([miss, miss, miss], state, config501);
    expect(result.newState.remaining).toBe(501);
    expect(result.scoreDelta).toBe(0);
    expect(result.isBust).toBe(false);
  });

  it('handles a turn with fewer than 3 darts when already bust-checked', () => {
    const state: X01PlayerState = { remaining: 50 };
    // Only 2 darts — no checkout or bust
    const result = processTurn([single(20), single(10)], state, config501);
    expect(result.newState.remaining).toBe(20);
    expect(result.scoreDelta).toBe(30);
    expect(result.isBust).toBe(false);
    expect(result.isComplete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

describe('processTurn — checkout', () => {
  it('checks out when remaining hits 0 with a double', () => {
    const state: X01PlayerState = { remaining: 40 };
    const result = processTurn([double(20)], state, config501);
    expect(result.newState.remaining).toBe(0);
    expect(result.isComplete).toBe(true);
    expect(result.isBust).toBe(false);
    expect(result.scoreDelta).toBe(40);
  });

  it('checks out with a double bull (25×2 = 50)', () => {
    const state: X01PlayerState = { remaining: 50 };
    const result = processTurn([doubleBull], state, config501);
    expect(result.newState.remaining).toBe(0);
    expect(result.isComplete).toBe(true);
    expect(result.isBust).toBe(false);
  });

  it('checks out mid-turn (dart 1 of 3)', () => {
    const state: X01PlayerState = { remaining: 32 };
    const result = processTurn([double(16), single(20), single(20)], state, config501);
    // Checkout on first dart — remaining darts are irrelevant
    expect(result.isComplete).toBe(true);
    expect(result.newState.remaining).toBe(0);
    expect(result.scoreDelta).toBe(32);
  });

  it('checks out on dart 2 of 3', () => {
    const state: X01PlayerState = { remaining: 52 };
    const result = processTurn([single(12), double(20)], state, config501);
    expect(result.isComplete).toBe(true);
    expect(result.newState.remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bust
// ---------------------------------------------------------------------------

describe('processTurn — bust', () => {
  it('busts when remaining goes below 0', () => {
    const state: X01PlayerState = { remaining: 20 };
    const result = processTurn([triple(20)], state, config501);
    // triple 20 = 60, 20 - 60 = -40 → bust
    expect(result.isBust).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.newState.remaining).toBe(20); // reverted
    expect(result.scoreDelta).toBe(0);
  });

  it('busts when remaining hits exactly 1 (cannot checkout from 1)', () => {
    const state: X01PlayerState = { remaining: 21 };
    const result = processTurn([single(20)], state, config501);
    // 21 - 20 = 1 → bust
    expect(result.isBust).toBe(true);
    expect(result.newState.remaining).toBe(21);
    expect(result.scoreDelta).toBe(0);
  });

  it('busts when remaining hits 0 with a single (not a double)', () => {
    const state: X01PlayerState = { remaining: 20 };
    const result = processTurn([single(20)], state, config501);
    // 20 - 20 = 0 but single, not double → bust
    expect(result.isBust).toBe(true);
    expect(result.newState.remaining).toBe(20);
    expect(result.scoreDelta).toBe(0);
  });

  it('busts when remaining hits 0 with a triple', () => {
    const state: X01PlayerState = { remaining: 60 };
    const result = processTurn([triple(20)], state, config501);
    expect(result.isBust).toBe(true);
    expect(result.newState.remaining).toBe(60);
  });

  it('single bull (25×1) on 25 remaining is a bust (not a double)', () => {
    const state: X01PlayerState = { remaining: 25 };
    const result = processTurn([singleBull], state, config501);
    expect(result.isBust).toBe(true);
    expect(result.newState.remaining).toBe(25);
  });

  it('busts on third dart even after two scoring darts', () => {
    const state: X01PlayerState = { remaining: 41 };
    // 20 + 20 = 40, remaining = 1 → bust on last dart
    const result = processTurn([single(20), single(20), single(1)], state, config501);
    expect(result.isBust).toBe(true);
    expect(result.newState.remaining).toBe(41);
    expect(result.scoreDelta).toBe(0);
  });

  it('busts on second dart and stops processing remaining darts', () => {
    const state: X01PlayerState = { remaining: 20 };
    // Second dart would overshoot; third dart should not be processed
    const result = processTurn([single(1), triple(20), double(20)], state, config501);
    // After single(1): remaining = 19. After triple(20) = 60: 19 - 60 = -41 → bust
    expect(result.isBust).toBe(true);
    expect(result.newState.remaining).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('processTurn — edge cases', () => {
  it('empty darts array ends turn with no change', () => {
    const state: X01PlayerState = { remaining: 501 };
    const result = processTurn([], state, config501);
    expect(result.newState.remaining).toBe(501);
    expect(result.scoreDelta).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.isBust).toBe(false);
  });

  it('works correctly with 301 starting score', () => {
    const state: X01PlayerState = { remaining: 301 };
    const result = processTurn([triple(20), triple(20), triple(20)], state, config301);
    // 60 + 60 + 60 = 180
    expect(result.newState.remaining).toBe(121);
    expect(result.scoreDelta).toBe(180);
  });

  it('checkout on double 2 from remaining 4', () => {
    const state: X01PlayerState = { remaining: 4 };
    const result = processTurn([double(2)], state, config301);
    expect(result.isComplete).toBe(true);
    expect(result.newState.remaining).toBe(0);
  });
});
