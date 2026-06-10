import { describe, it, expect, jest } from '@jest/globals';

import {
  getInitialPlayerState,
  processTurn,
  BERMUDA_TRIANGLE_TARGETS,
  BERMUDA_TRIANGLE_MAX_ROUNDS,
  type BermudaTrianglePlayerState,
} from '@/lib/games/bermuda-triangle';
import type { DartThrow } from '@/types/game';

jest.mock('@/db/client', () => ({ db: {} }));

const miss: DartThrow = { segment: 0, multiplier: 0 };

function makeState(totalScore: number, currentRound: number): BermudaTrianglePlayerState {
  return { totalScore, currentRound };
}

function hit(segment: number, multiplier = 1): DartThrow {
  return { segment, multiplier };
}

describe('BERMUDA_TRIANGLE_TARGETS', () => {
  it('has 12 rounds', () => {
    expect(BERMUDA_TRIANGLE_TARGETS.length).toBe(BERMUDA_TRIANGLE_MAX_ROUNDS);
  });

  it('has bull rounds at positions 4, 8, 12 (index 3, 7, 11)', () => {
    expect(BERMUDA_TRIANGLE_TARGETS[3]).toBe(25);
    expect(BERMUDA_TRIANGLE_TARGETS[7]).toBe(25);
    expect(BERMUDA_TRIANGLE_TARGETS[11]).toBe(25);
  });
});

describe('getInitialPlayerState', () => {
  it('starts at round 1 with 0 score', () => {
    expect(getInitialPlayerState()).toEqual({ totalScore: 0, currentRound: 1 });
  });
});

describe('processTurn', () => {
  const twoPlayers = [makeState(0, 1), makeState(0, 1)];

  it('scores hits on the current target', () => {
    const target = BERMUDA_TRIANGLE_TARGETS[0];
    const darts: DartThrow[] = [hit(target as number), miss, miss];
    const result = processTurn(darts, twoPlayers[0], twoPlayers, 0);
    expect(result.scoreDelta).toBe(target as number);
    expect(result.newState.totalScore).toBe(target as number);
  });

  it('scores triple on target', () => {
    const target = BERMUDA_TRIANGLE_TARGETS[0] as number;
    const darts: DartThrow[] = [hit(target, 3), miss, miss];
    const result = processTurn(darts, twoPlayers[0], twoPlayers, 0);
    expect(result.scoreDelta).toBe(target * 3);
  });

  it('adds zero for misses — no penalty', () => {
    const darts: DartThrow[] = [miss, miss, miss];
    const result = processTurn(darts, twoPlayers[0], twoPlayers, 0);
    expect(result.scoreDelta).toBe(0);
    expect(result.newState.totalScore).toBe(0);
  });

  it('advances currentRound after turn', () => {
    const darts: DartThrow[] = [miss, miss, miss];
    const result = processTurn(darts, twoPlayers[0], twoPlayers, 0);
    expect(result.newState.currentRound).toBe(2);
  });

  it('ignores darts that hit non-target segments', () => {
    const target = BERMUDA_TRIANGLE_TARGETS[0] as number;
    const wrong = target === 12 ? 13 : 12;
    const darts: DartThrow[] = [hit(wrong), hit(wrong), hit(wrong)];
    const result = processTurn(darts, twoPlayers[0], twoPlayers, 0);
    expect(result.scoreDelta).toBe(0);
  });

  describe('bull round (target = 25)', () => {
    const bullRoundIndex = 3;
    const bullState = makeState(0, bullRoundIndex + 1);

    it('single bull (25) scores 25', () => {
      const darts: DartThrow[] = [hit(25, 1), miss, miss];
      const states = [bullState, makeState(0, bullRoundIndex + 1)];
      const result = processTurn(darts, bullState, states, 0);
      expect(result.scoreDelta).toBe(25);
    });

    it('double bull (25×2) scores 50', () => {
      const darts: DartThrow[] = [hit(25, 2), miss, miss];
      const states = [bullState, makeState(0, bullRoundIndex + 1)];
      const result = processTurn(darts, bullState, states, 0);
      expect(result.scoreDelta).toBe(50);
    });

    it('does not count other segments on bull round', () => {
      const darts: DartThrow[] = [hit(20, 3), hit(19, 3), hit(18, 3)];
      const states = [bullState, makeState(0, bullRoundIndex + 1)];
      const result = processTurn(darts, bullState, states, 0);
      expect(result.scoreDelta).toBe(0);
    });
  });

  describe('game completion', () => {
    it('is not complete while players still have rounds remaining', () => {
      const darts: DartThrow[] = [miss, miss, miss];
      const result = processTurn(darts, twoPlayers[0], twoPlayers, 0);
      expect(result.isComplete).toBe(false);
      expect(result.winnerIndex).toBeNull();
    });

    it('is complete when last player finishes round 12', () => {
      const p0Done = makeState(100, BERMUDA_TRIANGLE_MAX_ROUNDS + 1);
      const p1Final = makeState(50, BERMUDA_TRIANGLE_MAX_ROUNDS);
      const darts: DartThrow[] = [miss, miss, miss];
      const result = processTurn(darts, p1Final, [p0Done, p1Final], 1);
      expect(result.isComplete).toBe(true);
    });

    it('picks the player with the highest score as winner', () => {
      const p0Done = makeState(100, BERMUDA_TRIANGLE_MAX_ROUNDS + 1);
      const p1Final = makeState(50, BERMUDA_TRIANGLE_MAX_ROUNDS);
      const darts: DartThrow[] = [miss, miss, miss];
      const result = processTurn(darts, p1Final, [p0Done, p1Final], 1);
      expect(result.winnerIndex).toBe(0);
    });

    it('returns winnerIndex null on a tie', () => {
      const p0Done = makeState(50, BERMUDA_TRIANGLE_MAX_ROUNDS + 1);
      const p1Final = makeState(50, BERMUDA_TRIANGLE_MAX_ROUNDS);
      const darts: DartThrow[] = [miss, miss, miss];
      const result = processTurn(darts, p1Final, [p0Done, p1Final], 1);
      expect(result.winnerIndex).toBeNull();
    });

    it('is not complete when other players still have rounds left', () => {
      const p0Active = makeState(0, 5);
      const p1Active = makeState(0, 5);
      const darts: DartThrow[] = [miss, miss, miss];
      const result = processTurn(darts, p0Active, [p0Active, p1Active], 0);
      expect(result.isComplete).toBe(false);
    });

    it('accounts for score from last turn when determining winner', () => {
      const target = BERMUDA_TRIANGLE_TARGETS[BERMUDA_TRIANGLE_MAX_ROUNDS - 1] as number;
      const p0Done = makeState(50, BERMUDA_TRIANGLE_MAX_ROUNDS + 1);
      const p1Final = makeState(0, BERMUDA_TRIANGLE_MAX_ROUNDS);
      const darts: DartThrow[] = [hit(target, 3), miss, miss];
      const result = processTurn(darts, p1Final, [p0Done, p1Final], 1);
      expect(result.isComplete).toBe(true);
      const p1FinalScore = 0 + target * 3;
      expect(result.winnerIndex).toBe(p1FinalScore > 50 ? 1 : 0);
    });
  });
});
