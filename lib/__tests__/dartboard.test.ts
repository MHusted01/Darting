import { describe, expect, it } from '@jest/globals';
import { BOARD_SEQUENCE, adjacentSegments } from '@/lib/dartboard';

describe('BOARD_SEQUENCE', () => {
  it('contains all 20 wedge numbers exactly once', () => {
    expect(BOARD_SEQUENCE).toHaveLength(20);
    expect(new Set(BOARD_SEQUENCE).size).toBe(20);
    for (let n = 1; n <= 20; n++) {
      expect(BOARD_SEQUENCE).toContain(n);
    }
  });

  it('starts at 20 with neighbours 1 and 5', () => {
    expect(BOARD_SEQUENCE[0]).toBe(20);
  });
});

describe('adjacentSegments', () => {
  it('returns the two physical neighbours of 20', () => {
    expect(adjacentSegments(20).sort((a, b) => a - b)).toEqual([1, 5]);
  });

  it('returns the two physical neighbours of 10', () => {
    expect(adjacentSegments(10).sort((a, b) => a - b)).toEqual([6, 15]);
  });

  it('wraps around the board (5 neighbours 20 and 12)', () => {
    expect(adjacentSegments(5).sort((a, b) => a - b)).toEqual([12, 20]);
  });

  it('returns an empty array for invalid segments (bull, miss, out of range)', () => {
    expect(adjacentSegments(25)).toEqual([]);
    expect(adjacentSegments(0)).toEqual([]);
    expect(adjacentSegments(21)).toEqual([]);
  });
});
