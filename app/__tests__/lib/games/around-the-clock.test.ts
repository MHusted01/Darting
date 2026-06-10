import { describe, expect, it } from '@jest/globals';
import {
  getInitialPlayerState,
  getMaxTarget,
  getTargetLabel,
  getTargetSegment,
  processTurn,
} from '@/lib/games/around-the-clock';
import type { DartThrow } from '@/types/game';

const dart = (segment: number, multiplier: number): DartThrow => ({ segment, multiplier });

describe('helpers', () => {
  it('caps the sequence at 20 without bull and 21 with bull', () => {
    expect(getMaxTarget({ includeBull: false })).toBe(20);
    expect(getMaxTarget({ includeBull: true })).toBe(21);
  });

  it('maps target 21 to the bull segment', () => {
    expect(getTargetSegment(21)).toBe(25);
    expect(getTargetSegment(7)).toBe(7);
  });

  it('labels target 21 as Bull', () => {
    expect(getTargetLabel(21)).toBe('Bull');
    expect(getTargetLabel(13)).toBe('13');
  });

  it('starts every player at target 1', () => {
    expect(getInitialPlayerState()).toEqual({ currentTarget: 1 });
  });
});

describe('processTurn', () => {
  it('advances one target per hit on the current target', () => {
    const result = processTurn([dart(1, 1), dart(2, 1), dart(3, 1)], { currentTarget: 1 }, { includeBull: false });

    expect(result.newState.currentTarget).toBe(4);
    expect(result.scoreDelta).toBe(3);
    expect(result.isComplete).toBe(false);
  });

  it('does not advance on a miss or a hit on the wrong number', () => {
    const result = processTurn([dart(0, 0), dart(5, 3), dart(2, 1)], { currentTarget: 1 }, { includeBull: false });

    expect(result.newState.currentTarget).toBe(1);
    expect(result.scoreDelta).toBe(0);
  });

  it('counts any multiplier of the target number as a hit', () => {
    const single = processTurn([dart(7, 1)], { currentTarget: 7 }, { includeBull: false });
    const double = processTurn([dart(7, 2)], { currentTarget: 7 }, { includeBull: false });
    const triple = processTurn([dart(7, 3)], { currentTarget: 7 }, { includeBull: false });

    expect(single.newState.currentTarget).toBe(8);
    expect(double.newState.currentTarget).toBe(8);
    expect(triple.newState.currentTarget).toBe(8);
  });

  it('completes when 20 is hit and bull is excluded', () => {
    const result = processTurn([dart(20, 1)], { currentTarget: 20 }, { includeBull: false });

    expect(result.isComplete).toBe(true);
    expect(result.newState.currentTarget).toBe(21);
  });

  it('requires the bull as the final target when included', () => {
    const at20 = processTurn([dart(20, 1)], { currentTarget: 20 }, { includeBull: true });
    expect(at20.isComplete).toBe(false);
    expect(at20.newState.currentTarget).toBe(21);

    const atBull = processTurn([dart(25, 1)], { currentTarget: 21 }, { includeBull: true });
    expect(atBull.isComplete).toBe(true);
  });

  it('stops processing darts after completion', () => {
    const result = processTurn(
      [dart(20, 1), dart(20, 1), dart(20, 1)],
      { currentTarget: 20 },
      { includeBull: false },
    );

    expect(result.newState.currentTarget).toBe(21);
    expect(result.scoreDelta).toBe(1);
    expect(result.isComplete).toBe(true);
  });

  it('does not mutate the input state', () => {
    const state = { currentTarget: 5 };
    processTurn([dart(5, 1)], state, { includeBull: false });
    expect(state.currentTarget).toBe(5);
  });
});
