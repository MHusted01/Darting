import { describe, it, expect, jest } from '@jest/globals';

import {
  computeThreeDartAvg,
  buildPersonalBestsFromRows,
  type PersonalBestRow,
} from '@/lib/stats';

jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/constants/games', () => ({
  GAMES: [
    { slug: 'x01', name: '501 / 301' },
    { slug: 'shanghai', name: 'Shanghai' },
    { slug: 'baseball', name: 'Baseball' },
    { slug: 'cricket', name: 'Cricket' },
  ],
}));

describe('computeThreeDartAvg', () => {
  it('returns 0 for empty turns', () => {
    expect(computeThreeDartAvg([])).toBe(0);
  });

  it('computes average from single turn of 3 darts', () => {
    const turns = [{ darts: 3, scoreDelta: 60 }];
    expect(computeThreeDartAvg(turns)).toBeCloseTo(60);
  });

  it('computes average across multiple turns', () => {
    const turns = [
      { darts: 3, scoreDelta: 60 },
      { darts: 3, scoreDelta: 45 },
    ];
    expect(computeThreeDartAvg(turns)).toBeCloseTo(52.5);
  });

  it('handles turns with fewer than 3 darts', () => {
    const turns = [
      { darts: 3, scoreDelta: 60 },
      { darts: 1, scoreDelta: 20 },
    ];
    expect(computeThreeDartAvg(turns)).toBeCloseTo((60 + 20) / 4 * 3);
  });

  it('returns 0 when total darts is zero', () => {
    const turns = [{ darts: 0, scoreDelta: 0 }];
    expect(computeThreeDartAvg(turns)).toBe(0);
  });

  it('handles zero score delta without dividing by zero', () => {
    const turns = [{ darts: 3, scoreDelta: 0 }];
    expect(computeThreeDartAvg(turns)).toBe(0);
  });
});

describe('buildPersonalBestsFromRows', () => {
  it('returns empty array for empty rows', () => {
    expect(buildPersonalBestsFromRows([])).toEqual([]);
  });

  it('maps a single row to a PersonalBest', () => {
    const rows: PersonalBestRow[] = [
      { gameSlug: 'shanghai', variant: null, gamesPlayed: 5, gamesWon: 2, bestScore: 120, avgThreeDartAvg: 18.5 },
    ];
    const result = buildPersonalBestsFromRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].gameSlug).toBe('shanghai');
    expect(result[0].gamesPlayed).toBe(5);
    expect(result[0].gamesWon).toBe(2);
    expect(result[0].bestScore).toBe(120);
    expect(result[0].avgThreeDartAvg).toBeCloseTo(18.5);
  });

  it('handles null avgThreeDartAvg', () => {
    const rows: PersonalBestRow[] = [
      { gameSlug: 'cricket', variant: null, gamesPlayed: 1, gamesWon: 0, bestScore: null, avgThreeDartAvg: null },
    ];
    const result = buildPersonalBestsFromRows(rows);
    expect(result[0].bestScore).toBeNull();
    expect(result[0].avgThreeDartAvg).toBeNull();
  });

  it('maps multiple rows preserving order', () => {
    const rows: PersonalBestRow[] = [
      { gameSlug: 'x01', variant: 501, gamesPlayed: 10, gamesWon: 4, bestScore: 0, avgThreeDartAvg: 32.0 },
      { gameSlug: 'baseball', variant: null, gamesPlayed: 3, gamesWon: 1, bestScore: 15, avgThreeDartAvg: 5.0 },
    ];
    const result = buildPersonalBestsFromRows(rows);
    expect(result[0].gameSlug).toBe('x01');
    expect(result[1].gameSlug).toBe('baseball');
  });
});
