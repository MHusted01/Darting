import { describe, expect, it } from '@jest/globals';
import {
  buildATCResults,
  buildCricketResults,
  buildHighScoreResults,
  buildX01Results,
  type SessionResultPlayerInput,
  type SessionTurnInput,
} from '@/lib/games/results';
import { getInitialPlayerState } from '@/lib/games/cricket';
import type { DartThrow } from '@/types/game';

const dart = (segment: number, multiplier: number): DartThrow => ({ segment, multiplier });

function player(
  playerId: number,
  gameState: unknown,
  isWinner = false,
): SessionResultPlayerInput {
  return { playerId, name: `P${playerId}`, avatarColor: '#abc', gameState, isWinner };
}

describe('buildX01Results', () => {
  const config = { startingScore: 501 as const, doubleOut: true };

  it('derives darts thrown and the 3-dart average from turns', () => {
    const players = [player(1, { remaining: 321 }, false)];
    const turns: SessionTurnInput[] = [
      { playerId: 1, darts: [dart(20, 3), dart(20, 3), dart(20, 3)] },
      { playerId: 1, darts: [dart(20, 1), dart(20, 1), dart(20, 1)] },
    ];

    const [result] = buildX01Results(players, turns, config);

    expect(result.dartsThrown).toBe(6);
    expect(result.threeDartAvg).toBeCloseTo(((501 - 321) / 6) * 3, 5);
    expect(result.turns).toBe(2);
  });

  it('returns a zero average when no darts were thrown', () => {
    const [result] = buildX01Results([player(1, { remaining: 501 })], [], config);
    expect(result.threeDartAvg).toBe(0);
    expect(result.dartsThrown).toBe(0);
  });

  it('puts the winner first, then sorts by lowest remaining', () => {
    const players = [
      player(1, { remaining: 40 }, false),
      player(2, { remaining: 0 }, true),
      player(3, { remaining: 20 }, false),
    ];

    const results = buildX01Results(players, [], config);

    expect(results.map((r) => r.name)).toEqual(['P2', 'P3', 'P1']);
  });
});

describe('buildCricketResults', () => {
  it('counts cricket hits and marks from turns and closed segments from state', () => {
    const state = getInitialPlayerState();
    const closed = {
      ...state,
      marks: { ...state.marks, 20: 3, 19: 4 },
      points: 19,
    };
    const turns: SessionTurnInput[] = [
      { playerId: 1, darts: [dart(20, 3), dart(5, 1), dart(0, 0)] },
      { playerId: 1, darts: [dart(19, 2), dart(19, 2)] },
    ];

    const [result] = buildCricketResults([player(1, closed, true)], turns);

    expect(result.totalDarts).toBe(5);
    expect(result.cricketHits).toBe(3);
    expect(result.totalMarks).toBe(7);
    expect(result.segmentsClosed).toBe(2);
    expect(result.points).toBe(19);
  });

  it('sorts winner first, then by points, then by segments closed', () => {
    const base = getInitialPlayerState();
    const players = [
      player(1, { ...base, points: 50 }, false),
      player(2, { ...base, points: 80 }, true),
      player(3, { ...base, marks: { ...base.marks, 20: 3 }, points: 50 }, false),
    ];

    const results = buildCricketResults(players, []);

    expect(results.map((r) => r.name)).toEqual(['P2', 'P3', 'P1']);
  });
});

describe('buildATCResults', () => {
  it('caps targetsHit at the max target and counts hits per dart', () => {
    const turns: SessionTurnInput[] = [
      { playerId: 1, darts: [dart(1, 1), dart(0, 0), dart(2, 1)] },
    ];

    const [result] = buildATCResults(
      [player(1, { currentTarget: 21 }, true)],
      turns,
      { includeBull: false },
    );

    expect(result.targetsHit).toBe(20);
    expect(result.maxTarget).toBe(20);
    expect(result.totalDarts).toBe(3);
    expect(result.hits).toBe(2);
  });

  it('sorts winner first, then by targets hit', () => {
    const players = [
      player(1, { currentTarget: 5 }, false),
      player(2, { currentTarget: 12 }, false),
      player(3, { currentTarget: 21 }, true),
    ];

    const results = buildATCResults(players, [], { includeBull: false });

    expect(results.map((r) => r.name)).toEqual(['P3', 'P2', 'P1']);
  });
});

describe('buildHighScoreResults (score games)', () => {
  it('reads the score from state and sorts winner first, then by score', () => {
    const players = [
      player(1, { totalScore: 310 }, false),
      player(2, { totalScore: 450 }, true),
      player(3, { totalScore: 390 }, false),
    ];
    const turns: SessionTurnInput[] = [
      { playerId: 1, darts: [dart(20, 1), dart(20, 1), dart(20, 1)] },
    ];

    const results = buildHighScoreResults(players, turns);

    expect(results.map((r) => r.name)).toEqual(['P2', 'P3', 'P1']);
    expect(results[2].totalDarts).toBe(3);
    expect(results[2].turns).toBe(1);
  });
});
