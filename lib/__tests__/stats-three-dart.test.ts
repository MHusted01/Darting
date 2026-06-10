import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/db/client', () => ({ db: {} }));

import { resolveTrendSlug, sessionThreeDartAvg } from '@/lib/stats';

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
