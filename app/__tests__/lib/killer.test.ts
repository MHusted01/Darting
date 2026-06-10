import { describe, it, expect, jest } from '@jest/globals';

import {
  getInitialPlayerState,
  processTurn,
  derivePhase,
  getNextPlayerIndex,
  type KillerPlayerState,
} from '@/lib/games/killer';
import type { DartThrow } from '@/types/game';

jest.mock('@/db/client', () => ({ db: {} }));

const miss: DartThrow = { segment: 0, multiplier: 0 };

function hit(segment: number, multiplier = 1): DartThrow {
  return { segment, multiplier };
}

function dbl(segment: number): DartThrow {
  return { segment, multiplier: 2 };
}

function makeState(overrides: Partial<KillerPlayerState> = {}): KillerPlayerState {
  return {
    assignedNumber: null,
    isKiller: false,
    lives: 3,
    isEliminated: false,
    ...overrides,
  };
}

describe('getInitialPlayerState', () => {
  it('starts with null number, not a killer, 3 lives, not eliminated', () => {
    expect(getInitialPlayerState()).toEqual({
      assignedNumber: null,
      isKiller: false,
      lives: 3,
      isEliminated: false,
    });
  });
});

describe('derivePhase', () => {
  it('returns assign when any player has null assignedNumber', () => {
    const states = [makeState(), makeState({ assignedNumber: 5 })];
    expect(derivePhase(states)).toBe('assign');
  });

  it('returns play when all players have a number', () => {
    const states = [makeState({ assignedNumber: 1 }), makeState({ assignedNumber: 5 })];
    expect(derivePhase(states)).toBe('play');
  });

  it('returns play with single player assigned', () => {
    const states = [makeState({ assignedNumber: 7 })];
    expect(derivePhase(states)).toBe('play');
  });
});

describe('getNextPlayerIndex', () => {
  it('advances to next player normally', () => {
    const states = [
      makeState({ assignedNumber: 1 }),
      makeState({ assignedNumber: 2 }),
      makeState({ assignedNumber: 3 }),
    ];
    expect(getNextPlayerIndex(states, 0)).toBe(1);
    expect(getNextPlayerIndex(states, 1)).toBe(2);
  });

  it('wraps around to first player', () => {
    const states = [
      makeState({ assignedNumber: 1 }),
      makeState({ assignedNumber: 2 }),
      makeState({ assignedNumber: 3 }),
    ];
    expect(getNextPlayerIndex(states, 2)).toBe(0);
  });

  it('skips eliminated players', () => {
    const states = [
      makeState({ assignedNumber: 1 }),
      makeState({ assignedNumber: 2, isEliminated: true }),
      makeState({ assignedNumber: 3 }),
    ];
    expect(getNextPlayerIndex(states, 0)).toBe(2);
  });

  it('wraps and skips eliminated players', () => {
    const states = [
      makeState({ assignedNumber: 1 }),
      makeState({ assignedNumber: 2, isEliminated: true }),
      makeState({ assignedNumber: 3 }),
    ];
    expect(getNextPlayerIndex(states, 2)).toBe(0);
  });
});

describe('processTurn — assign phase', () => {
  it('assigns the first valid 1–20 hit as the player number', () => {
    const states = [makeState(), makeState()];
    const darts: DartThrow[] = [hit(7), miss, miss];
    const result = processTurn(darts, states, 0, new Set());
    expect(result.updatedPlayerStates[0].assignedNumber).toBe(7);
  });

  it('skips a dart that hits an already-taken number', () => {
    const states = [makeState(), makeState()];
    const darts: DartThrow[] = [hit(5), hit(8), miss];
    const result = processTurn(darts, states, 0, new Set([5]));
    expect(result.updatedPlayerStates[0].assignedNumber).toBe(8);
  });

  it('auto-assigns lowest available number if all darts miss or conflict', () => {
    const states = [makeState(), makeState()];
    const darts: DartThrow[] = [miss, miss, miss];
    const takenNumbers = new Set([1, 2, 3]);
    const result = processTurn(darts, states, 0, takenNumbers);
    expect(result.updatedPlayerStates[0].assignedNumber).toBe(4);
  });

  it('does not assign bull (25) as a number', () => {
    const states = [makeState(), makeState()];
    const darts: DartThrow[] = [hit(25), hit(5), miss];
    const result = processTurn(darts, states, 0, new Set());
    expect(result.updatedPlayerStates[0].assignedNumber).toBe(5);
  });

  it('does not modify other players states during assign', () => {
    const states = [makeState(), makeState({ assignedNumber: 3 })];
    const darts: DartThrow[] = [hit(7), miss, miss];
    const result = processTurn(darts, states, 0, new Set([3]));
    expect(result.updatedPlayerStates[1].assignedNumber).toBe(3);
  });

  it('is not complete during assign phase', () => {
    const states = [makeState(), makeState()];
    const darts: DartThrow[] = [hit(7), miss, miss];
    const result = processTurn(darts, states, 0, new Set());
    expect(result.isComplete).toBe(false);
  });
});

describe('processTurn — earn killer (play phase, not yet a killer)', () => {
  it('hitting own double makes player a killer', () => {
    const states = [makeState({ assignedNumber: 7 }), makeState({ assignedNumber: 3 })];
    const darts: DartThrow[] = [dbl(7), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.updatedPlayerStates[0].isKiller).toBe(true);
  });

  it('missing own double keeps player as non-killer', () => {
    const states = [makeState({ assignedNumber: 7 }), makeState({ assignedNumber: 3 })];
    const darts: DartThrow[] = [dbl(3), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.updatedPlayerStates[0].isKiller).toBe(false);
  });

  it('hitting a non-killer double has no effect on opponents lives', () => {
    const states = [
      makeState({ assignedNumber: 7 }),
      makeState({ assignedNumber: 3 }),
    ];
    const darts: DartThrow[] = [dbl(3), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.updatedPlayerStates[1].lives).toBe(3);
  });
});

describe('processTurn — eliminate phase (is a killer)', () => {
  it('hitting opponent double removes 1 life from opponent', () => {
    const states = [
      makeState({ assignedNumber: 7, isKiller: true }),
      makeState({ assignedNumber: 3 }),
    ];
    const darts: DartThrow[] = [dbl(3), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.updatedPlayerStates[1].lives).toBe(2);
  });

  it('hitting own double while a killer removes 1 life from self (penalty)', () => {
    const states = [
      makeState({ assignedNumber: 7, isKiller: true }),
      makeState({ assignedNumber: 3 }),
    ];
    const darts: DartThrow[] = [dbl(7), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.updatedPlayerStates[0].lives).toBe(2);
  });

  it('eliminates opponent at 0 lives', () => {
    const states = [
      makeState({ assignedNumber: 7, isKiller: true }),
      makeState({ assignedNumber: 3, lives: 1 }),
    ];
    const darts: DartThrow[] = [dbl(3), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.updatedPlayerStates[1].lives).toBe(0);
    expect(result.updatedPlayerStates[1].isEliminated).toBe(true);
  });

  it('can hit multiple opponent doubles in one turn', () => {
    const states = [
      makeState({ assignedNumber: 7, isKiller: true }),
      makeState({ assignedNumber: 3 }),
      makeState({ assignedNumber: 5 }),
    ];
    const darts: DartThrow[] = [dbl(3), dbl(5), miss];
    const result = processTurn(darts, states, 0, new Set([7, 3, 5]));
    expect(result.updatedPlayerStates[1].lives).toBe(2);
    expect(result.updatedPlayerStates[2].lives).toBe(2);
  });
});

describe('processTurn — game completion', () => {
  it('is complete when only one player remains', () => {
    const states = [
      makeState({ assignedNumber: 7, isKiller: true }),
      makeState({ assignedNumber: 3, lives: 1 }),
    ];
    const darts: DartThrow[] = [dbl(3), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBe(0);
  });

  it('is not complete while multiple players have lives', () => {
    const states = [
      makeState({ assignedNumber: 7, isKiller: true }),
      makeState({ assignedNumber: 3, lives: 2 }),
    ];
    const darts: DartThrow[] = [dbl(3), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.isComplete).toBe(false);
  });

  it('is complete with no winner (tie) when self-elimination leaves 0 active players', () => {
    const states = [
      makeState({ assignedNumber: 7, isKiller: true, lives: 1 }),
      makeState({ assignedNumber: 3, isEliminated: true, lives: 0 }),
    ];
    const darts: DartThrow[] = [dbl(7), miss, miss];
    const result = processTurn(darts, states, 0, new Set([7, 3]));
    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBeNull();
    expect(result.updatedPlayerStates[0].isEliminated).toBe(true);
  });
});
