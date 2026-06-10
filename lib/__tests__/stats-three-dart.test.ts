import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/db/client', () => ({ db: {} }));

import {
  buildPersonalBestsFromRows,
  resolveTrendSlug,
  resolveX01Variant,
  sessionThreeDartAvg,
  x01VariantCondition,
} from '@/lib/stats';

describe('resolveTrendSlug', () => {
  it('defaults to x01 when no slug filter is provided', () => {
    expect(resolveTrendSlug(undefined)).toBe('x01');
  });

  it('keeps an explicit slug filter unchanged', () => {
    expect(resolveTrendSlug('cricket')).toBe('cricket');
    expect(resolveTrendSlug('x01')).toBe('x01');
  });
});

describe('sessionThreeDartAvg', () => {
  const turns = [
    { darts: 3, scoreDelta: 180 },
    { darts: 3, scoreDelta: 60 },
  ];

  it('computes the 3-dart average for x01 sessions', () => {
    expect(sessionThreeDartAvg('x01', turns)).toBeCloseTo(120, 5);
  });

  it('returns null for non-x01 sessions', () => {
    expect(sessionThreeDartAvg('cricket', turns)).toBeNull();
    expect(sessionThreeDartAvg('around-the-clock', turns)).toBeNull();
    expect(sessionThreeDartAvg('high-score', turns)).toBeNull();
  });

  it('returns 0 for an x01 session with no darts', () => {
    expect(sessionThreeDartAvg('x01', [])).toBe(0);
  });
});

describe('resolveX01Variant', () => {
  it('reads the starting score from an x01 config object', () => {
    expect(resolveX01Variant('x01', { startingScore: 301 })).toBe(301);
    expect(resolveX01Variant('x01', { startingScore: 501 })).toBe(501);
  });

  it('defaults to 501 when config is missing', () => {
    expect(resolveX01Variant('x01', null)).toBe(501);
    expect(resolveX01Variant('x01', undefined)).toBe(501);
    expect(resolveX01Variant('x01', {})).toBe(501);
  });

  it('defaults to 501 for invalid starting scores', () => {
    expect(resolveX01Variant('x01', { startingScore: 999 })).toBe(501);
    expect(resolveX01Variant('x01', { startingScore: 'abc' })).toBe(501);
  });

  it('parses a JSON string config defensively', () => {
    expect(resolveX01Variant('x01', '{"startingScore":301}')).toBe(301);
    expect(resolveX01Variant('x01', 'not json')).toBe(501);
  });

  it('accepts a string starting score inside a parsed config', () => {
    expect(resolveX01Variant('x01', { startingScore: '301' })).toBe(301);
    expect(resolveX01Variant('x01', { startingScore: '501' })).toBe(501);
  });

  it('returns null for non-x01 games', () => {
    expect(resolveX01Variant('cricket', { startingScore: 301 })).toBeNull();
    expect(resolveX01Variant('around-the-clock', null)).toBeNull();
  });
});

describe('x01VariantCondition', () => {
  it('returns undefined when no variant is given', () => {
    expect(x01VariantCondition(undefined)).toBeUndefined();
  });

  it('returns a SQL condition for an explicit variant', () => {
    expect(x01VariantCondition(501)).toBeDefined();
    expect(x01VariantCondition(301)).toBeDefined();
  });
});

describe('buildPersonalBestsFromRows variant naming', () => {
  const base = { gamesPlayed: 1, gamesWon: 1, bestScore: null, avgThreeDartAvg: null };

  it('names x01 rows by variant', () => {
    const rows = buildPersonalBestsFromRows([
      { ...base, gameSlug: 'x01', variant: 501 },
      { ...base, gameSlug: 'x01', variant: 301 },
    ]);
    expect(rows.map((r) => r.gameName)).toEqual(['501', '301']);
  });

  it('keeps non-x01 rows on the game name', () => {
    const rows = buildPersonalBestsFromRows([{ ...base, gameSlug: 'cricket', variant: null }]);
    expect(rows[0].gameName).toBe('Cricket');
  });
});
