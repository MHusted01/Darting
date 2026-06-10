import { describe, expect, it } from '@jest/globals';
import {
  applyGameTurn,
  buildTurnPayload,
  configFromChallengeSettings,
  initialStateForSlug,
  parseTurnPayload,
  type TurnBroadcastPayload,
} from '@/lib/realtime-game';
import { processTurn as processX01Turn, type X01Config, type X01PlayerState } from '@/lib/games/x01';
import { processTurn as processCricketTurn, getInitialPlayerState as getCricketInitialState, type CricketConfig, type CricketPlayerState } from '@/lib/games/cricket';
import { getInitialPlayerState as getShanghaiInitialState, type ShanghaiPlayerState } from '@/lib/games/shanghai';
import type { DartThrow } from '@/types/game';

const CHALLENGE_ID = 'challenge-1';
const USER_A = 'user-a';
const USER_B = 'user-b';

function payload(overrides: Partial<TurnBroadcastPayload> = {}): TurnBroadcastPayload {
  return {
    challengeId: CHALLENGE_ID,
    turnSeq: 1,
    userId: USER_A,
    darts: [{ segment: 20, multiplier: 3 }],
    isComplete: false,
    winnerUserId: null,
    scores: { [USER_A]: 60, [USER_B]: 0 },
    ...overrides,
  };
}

describe('buildTurnPayload / parseTurnPayload', () => {
  it('round-trips a payload through JSON', () => {
    const built = buildTurnPayload({
      challengeId: CHALLENGE_ID,
      turnSeq: 3,
      userId: USER_B,
      darts: [
        { segment: 20, multiplier: 3 },
        { segment: 19, multiplier: 1 },
        { segment: 0, multiplier: 0 },
      ],
      isComplete: true,
      winnerUserId: USER_B,
      scores: { [USER_A]: 140, [USER_B]: 501 },
    });
    const parsed = parseTurnPayload(JSON.parse(JSON.stringify(built)));
    expect(parsed).toEqual(built);
  });

  it('returns null for non-objects', () => {
    expect(parseTurnPayload(null)).toBeNull();
    expect(parseTurnPayload('turn')).toBeNull();
    expect(parseTurnPayload(42)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    const { turnSeq: _turnSeq, ...rest } = payload();
    expect(parseTurnPayload(rest)).toBeNull();
  });

  it('returns null for invalid darts', () => {
    expect(parseTurnPayload(payload({ darts: [] }))).toBeNull();
    expect(
      parseTurnPayload(
        payload({
          darts: [
            { segment: 1, multiplier: 1 },
            { segment: 1, multiplier: 1 },
            { segment: 1, multiplier: 1 },
            { segment: 1, multiplier: 1 },
          ],
        }),
      ),
    ).toBeNull();
    expect(parseTurnPayload(payload({ darts: [{ segment: 26, multiplier: 1 }] }))).toBeNull();
    expect(parseTurnPayload(payload({ darts: [{ segment: 20, multiplier: 4 }] }))).toBeNull();
    expect(
      parseTurnPayload(payload({ darts: [{ segment: '20', multiplier: 1 }] as unknown as DartThrow[] })),
    ).toBeNull();
  });

  it('returns null for invalid scores map', () => {
    expect(
      parseTurnPayload(payload({ scores: { [USER_A]: 'sixty' } as unknown as Record<string, number> })),
    ).toBeNull();
  });
});

describe('configFromChallengeSettings', () => {
  it('builds X01 config with default 501', () => {
    expect(configFromChallengeSettings('x01', {})).toEqual({ startingScore: 501 });
  });

  it('builds X01 config with explicit 301', () => {
    expect(configFromChallengeSettings('x01', { startingScore: 301 })).toEqual({ startingScore: 301 });
  });

  it('falls back to 501 for invalid starting scores', () => {
    expect(configFromChallengeSettings('x01', { startingScore: 170 })).toEqual({ startingScore: 501 });
  });

  it('builds Around the Clock config with includeBull default false', () => {
    expect(configFromChallengeSettings('around-the-clock', {})).toEqual({ includeBull: false });
    expect(configFromChallengeSettings('around-the-clock', { includeBull: true })).toEqual({
      includeBull: true,
    });
  });

  it('builds Cricket config with standard variant', () => {
    expect(configFromChallengeSettings('cricket', {})).toEqual({ variant: 'standard' });
  });

  it('returns empty config for round-based games', () => {
    expect(configFromChallengeSettings('shanghai', {})).toEqual({});
    expect(configFromChallengeSettings('high-score', {})).toEqual({});
  });
});

describe('initialStateForSlug', () => {
  it('builds X01 initial state from config', () => {
    expect(initialStateForSlug('x01', { startingScore: 301 })).toEqual({ remaining: 301 });
  });

  it('builds initial states for other games', () => {
    expect(initialStateForSlug('around-the-clock', { includeBull: false })).toEqual({
      currentTarget: 1,
    });
    expect(initialStateForSlug('shanghai', {})).toEqual({ totalScore: 0, currentRound: 1 });
  });

  it('throws for unsupported slugs', () => {
    expect(() => initialStateForSlug('killer', {})).toThrow();
  });
});

describe('applyGameTurn', () => {
  describe('x01', () => {
    const config: X01Config = { startingScore: 501 };

    function x01Players(remainingA: number, remainingB: number) {
      return [
        { gameState: { remaining: remainingA } as X01PlayerState, currentScore: 501 - remainingA },
        { gameState: { remaining: remainingB } as X01PlayerState, currentScore: 501 - remainingB },
      ];
    }

    it('matches processTurn for a normal scoring turn', () => {
      const darts: DartThrow[] = [
        { segment: 20, multiplier: 3 },
        { segment: 20, multiplier: 3 },
        { segment: 20, multiplier: 1 },
      ];
      const expected = processX01Turn(darts, { remaining: 501 }, config);
      const applied = applyGameTurn('x01', config, x01Players(501, 501), 0, darts);
      expect(applied.newState).toEqual(expected.newState);
      expect(applied.scoreDelta).toBe(expected.scoreDelta);
      expect(applied.isComplete).toBe(false);
      expect(applied.newScore).toBe(501 - expected.newState.remaining);
    });

    it('handles a bust without completing', () => {
      const darts: DartThrow[] = [{ segment: 20, multiplier: 3 }];
      const applied = applyGameTurn('x01', config, x01Players(40, 100), 0, darts);
      expect(applied.isComplete).toBe(false);
      expect((applied.newState as X01PlayerState).remaining).toBe(40);
    });

    it('completes on checkout with current player as winner', () => {
      const darts: DartThrow[] = [{ segment: 20, multiplier: 2 }];
      const applied = applyGameTurn('x01', config, x01Players(40, 100), 0, darts);
      expect(applied.isComplete).toBe(true);
      expect(applied.winnerIndex).toBeUndefined();
      expect(applied.newScore).toBe(501);
    });
  });

  describe('around-the-clock', () => {
    const config = { includeBull: false };

    it('advances the target and accumulates score', () => {
      const players = [
        { gameState: { currentTarget: 5 }, currentScore: 4 },
        { gameState: { currentTarget: 1 }, currentScore: 0 },
      ];
      const darts: DartThrow[] = [
        { segment: 5, multiplier: 1 },
        { segment: 6, multiplier: 1 },
        { segment: 9, multiplier: 1 },
      ];
      const applied = applyGameTurn('around-the-clock', config, players, 0, darts);
      expect(applied.newState).toEqual({ currentTarget: 7 });
      expect(applied.scoreDelta).toBe(2);
      expect(applied.newScore).toBe(6);
      expect(applied.isComplete).toBe(false);
    });

    it('completes when passing the max target', () => {
      const players = [
        { gameState: { currentTarget: 20 }, currentScore: 19 },
        { gameState: { currentTarget: 3 }, currentScore: 2 },
      ];
      const applied = applyGameTurn('around-the-clock', config, players, 0, [
        { segment: 20, multiplier: 1 },
      ]);
      expect(applied.isComplete).toBe(true);
      expect(applied.winnerIndex).toBeUndefined();
    });
  });

  describe('cricket', () => {
    const config: CricketConfig = { variant: 'standard' };

    it('matches processTurn output', () => {
      const stateA = getCricketInitialState();
      const stateB = getCricketInitialState();
      const players = [
        { gameState: stateA, currentScore: 0 },
        { gameState: stateB, currentScore: 0 },
      ];
      const darts: DartThrow[] = [
        { segment: 20, multiplier: 3 },
        { segment: 20, multiplier: 1 },
        { segment: 19, multiplier: 2 },
      ];
      const expected = processCricketTurn(darts, stateA, [stateA, stateB], 0, config);
      const applied = applyGameTurn('cricket', config, players, 0, darts);
      expect(applied.newState).toEqual(expected.newState);
      expect(applied.newScore).toBe((expected.newState as CricketPlayerState).points);
      expect(applied.isComplete).toBe(expected.isComplete);
    });

    it('surfaces the winning player index on completion', () => {
      const closedMarks = { 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 0, 25: 3 };
      const stateA: CricketPlayerState = { marks: { ...closedMarks }, points: 100 };
      const stateB: CricketPlayerState = { marks: { ...closedMarks, 20: 3 }, points: 0 };
      const players = [
        { gameState: stateA, currentScore: 100 },
        { gameState: stateB, currentScore: 0 },
      ];
      const darts: DartThrow[] = [
        { segment: 20, multiplier: 3 },
        { segment: 0, multiplier: 0 },
        { segment: 0, multiplier: 0 },
      ];
      const expected = processCricketTurn(darts, stateA, [stateA, stateB], 0, config);
      expect(expected.isComplete).toBe(true);
      const applied = applyGameTurn('cricket', config, players, 0, darts);
      expect(applied.isComplete).toBe(true);
      expect(applied.winnerIndex ?? 0).toBe(0);
    });
  });

  describe('round-based games', () => {
    it('applies a shanghai turn and surfaces the winner index on completion', () => {
      const stateA: ShanghaiPlayerState = { totalScore: 30, currentRound: 7 };
      const stateB: ShanghaiPlayerState = { totalScore: 10, currentRound: 7 };
      const players = [
        { gameState: stateA, currentScore: 30 },
        { gameState: stateB, currentScore: 10 },
      ];
      const darts: DartThrow[] = [
        { segment: 7, multiplier: 1 },
        { segment: 0, multiplier: 0 },
        { segment: 0, multiplier: 0 },
      ];
      const appliedA = applyGameTurn('shanghai', {}, players, 0, darts);
      expect(appliedA.isComplete).toBe(false);
      expect(appliedA.newScore).toBe(37);

      const playersAfterA = [
        { gameState: appliedA.newState, currentScore: appliedA.newScore },
        { gameState: stateB, currentScore: 10 },
      ];
      const appliedB = applyGameTurn('shanghai', {}, playersAfterA, 1, [
        { segment: 0, multiplier: 0 },
        { segment: 0, multiplier: 0 },
        { segment: 0, multiplier: 0 },
      ]);
      expect(appliedB.isComplete).toBe(true);
      expect(appliedB.winnerIndex).toBe(0);
    });

    it('reports a tie as a null winner index', () => {
      const players = [
        { gameState: { totalScore: 0, currentRound: 8 } as ShanghaiPlayerState, currentScore: 0 },
        { gameState: { totalScore: 0, currentRound: 7 } as ShanghaiPlayerState, currentScore: 0 },
      ];
      const applied = applyGameTurn('shanghai', {}, players, 1, [
        { segment: 0, multiplier: 0 },
        { segment: 0, multiplier: 0 },
        { segment: 0, multiplier: 0 },
      ]);
      expect(applied.isComplete).toBe(true);
      expect(applied.winnerIndex).toBeNull();
    });

    it('applies shanghai initial state from getInitialPlayerState', () => {
      expect(getShanghaiInitialState()).toEqual({ totalScore: 0, currentRound: 1 });
    });
  });

  it('throws for unsupported slugs', () => {
    expect(() =>
      applyGameTurn('killer', {}, [{ gameState: {}, currentScore: 0 }], 0, [
        { segment: 1, multiplier: 1 },
      ]),
    ).toThrow();
  });
});
