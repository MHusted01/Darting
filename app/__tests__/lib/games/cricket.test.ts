import { describe, expect, it } from '@jest/globals';
import {
  CRICKET_SEGMENTS,
  areAllSegmentsClosed,
  checkGameComplete,
  getInitialPlayerState,
  getMarksFromDart,
  getSegmentLabel,
  isCricketSegment,
  isSegmentClosed,
  processTurn,
  type CricketPlayerState,
  type SegmentMarks,
} from '@/lib/games/cricket';
import type { DartThrow } from '@/types/game';

const CONFIG = { variant: 'standard' as const };

function stateWith(marks: Partial<SegmentMarks>, points = 0): CricketPlayerState {
  const base = getInitialPlayerState();
  return { marks: { ...base.marks, ...marks }, points };
}

function closedState(points = 0): CricketPlayerState {
  return stateWith({ 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3, 25: 3 }, points);
}

const dart = (segment: number, multiplier: number): DartThrow => ({ segment, multiplier });

describe('getInitialPlayerState', () => {
  it('starts with zero marks on every segment and zero points', () => {
    const state = getInitialPlayerState();
    for (const seg of CRICKET_SEGMENTS) {
      expect(state.marks[seg]).toBe(0);
    }
    expect(state.points).toBe(0);
  });
});

describe('mark helpers', () => {
  it('closes a segment at three or more marks', () => {
    expect(isSegmentClosed(2)).toBe(false);
    expect(isSegmentClosed(3)).toBe(true);
    expect(isSegmentClosed(4)).toBe(true);
  });

  it('recognises only 15-20 and bull as cricket segments', () => {
    expect(isCricketSegment(15)).toBe(true);
    expect(isCricketSegment(20)).toBe(true);
    expect(isCricketSegment(25)).toBe(true);
    expect(isCricketSegment(14)).toBe(false);
    expect(isCricketSegment(21)).toBe(false);
    expect(isCricketSegment(0)).toBe(false);
  });

  it('labels bull and numbers', () => {
    expect(getSegmentLabel(25)).toBe('Bull');
    expect(getSegmentLabel(20)).toBe('20');
  });

  it('reports all segments closed only when every segment has 3+ marks', () => {
    expect(areAllSegmentsClosed(closedState())).toBe(true);
    expect(areAllSegmentsClosed(stateWith({ 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3, 25: 2 }))).toBe(false);
  });
});

describe('getMarksFromDart', () => {
  it('returns marks equal to the multiplier for cricket segments', () => {
    expect(getMarksFromDart(dart(20, 1))).toEqual({ segment: 20, marks: 1 });
    expect(getMarksFromDart(dart(19, 3))).toEqual({ segment: 19, marks: 3 });
    expect(getMarksFromDart(dart(25, 2))).toEqual({ segment: 25, marks: 2 });
  });

  it('ignores misses and non-cricket segments', () => {
    expect(getMarksFromDart(dart(0, 0))).toEqual({ segment: null, marks: 0 });
    expect(getMarksFromDart(dart(5, 3))).toEqual({ segment: null, marks: 0 });
    expect(getMarksFromDart(dart(14, 1))).toEqual({ segment: null, marks: 0 });
  });

  it('rejects a triple bull (no triple ring on the bull)', () => {
    expect(getMarksFromDart(dart(25, 3))).toEqual({ segment: null, marks: 0 });
  });

  it('rejects invalid multipliers', () => {
    expect(getMarksFromDart(dart(20, 0))).toEqual({ segment: null, marks: 0 });
    expect(getMarksFromDart(dart(20, 4))).toEqual({ segment: null, marks: 0 });
    expect(getMarksFromDart(dart(20, 1.5))).toEqual({ segment: null, marks: 0 });
  });
});

describe('processTurn — marking', () => {
  it('accumulates marks without scoring before a segment is closed', () => {
    const me = getInitialPlayerState();
    const opp = getInitialPlayerState();
    const result = processTurn([dart(20, 1), dart(20, 1)], me, [me, opp], 0, CONFIG);

    expect(result.newState.marks[20]).toBe(2);
    expect(result.scoreDelta).toBe(0);
    expect(result.isComplete).toBe(false);
  });

  it('scores excess marks on the closing dart when an opponent is still open', () => {
    const me = stateWith({ 20: 2 });
    const opp = getInitialPlayerState();
    const result = processTurn([dart(20, 3)], me, [me, opp], 0, CONFIG);

    expect(result.newState.marks[20]).toBe(3);
    expect(result.scoreDelta).toBe(40);
  });

  it('scores full value on hits after the segment is closed while opponents are open', () => {
    const me = stateWith({ 20: 3 });
    const opp = getInitialPlayerState();
    const result = processTurn([dart(20, 3)], me, [me, opp], 0, CONFIG);

    expect(result.scoreDelta).toBe(60);
  });

  it('does not score on a segment every opponent has closed', () => {
    const me = stateWith({ 20: 3 });
    const opp = stateWith({ 20: 3 });
    const result = processTurn([dart(20, 3)], me, [me, opp], 0, CONFIG);

    expect(result.scoreDelta).toBe(0);
  });

  it('does not score excess marks on the closing dart when all opponents already closed it', () => {
    const me = stateWith({ 20: 2 });
    const opp = stateWith({ 20: 3 });
    const result = processTurn([dart(20, 3)], me, [me, opp], 0, CONFIG);

    expect(result.newState.marks[20]).toBe(3);
    expect(result.scoreDelta).toBe(0);
  });

  it('scores bull at 25 per mark', () => {
    const me = stateWith({ 25: 3 });
    const opp = getInitialPlayerState();
    const result = processTurn([dart(25, 2)], me, [me, opp], 0, CONFIG);

    expect(result.scoreDelta).toBe(50);
  });

  it('processes darts in order across close-then-score within one turn', () => {
    const me = stateWith({ 20: 1 });
    const opp = getInitialPlayerState();
    const result = processTurn([dart(20, 3), dart(20, 1)], me, [me, opp], 0, CONFIG);

    expect(result.newState.marks[20]).toBe(3);
    expect(result.scoreDelta).toBe(20 + 20);
  });

  it('does not mutate the input state', () => {
    const me = getInitialPlayerState();
    const opp = getInitialPlayerState();
    processTurn([dart(20, 3)], me, [me, opp], 0, CONFIG);

    expect(me.marks[20]).toBe(0);
    expect(me.points).toBe(0);
  });
});

describe('checkGameComplete', () => {
  it('declares a winner who closed everything with the points lead', () => {
    const result = checkGameComplete([closedState(100), stateWith({ 20: 3 }, 50)]);
    expect(result).toEqual({ isComplete: true, winnerIndex: 0 });
  });

  it('keeps the game running when the closed player is behind on points', () => {
    const result = checkGameComplete([closedState(40), stateWith({ 20: 3 }, 80)]);
    expect(result).toEqual({ isComplete: false, winnerIndex: null });
  });

  it('declares a winner who closed everything and is tied on points', () => {
    const result = checkGameComplete([closedState(50), stateWith({}, 50)]);
    expect(result).toEqual({ isComplete: true, winnerIndex: 0 });
  });

  it('picks the highest score when everyone has closed all segments', () => {
    const result = checkGameComplete([closedState(40), closedState(90)]);
    expect(result).toEqual({ isComplete: true, winnerIndex: 1 });
  });

  it('keeps a game with no closed-out players running', () => {
    const result = checkGameComplete([stateWith({ 20: 3 }, 60), stateWith({ 19: 3 }, 19)]);
    expect(result).toEqual({ isComplete: false, winnerIndex: null });
  });
});

describe('processTurn — completion', () => {
  it('ends the game when the closing dart secures the win', () => {
    const me = stateWith({ 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 2, 25: 3 }, 60);
    const opp = stateWith({}, 20);
    const result = processTurn([dart(20, 1)], me, [me, opp], 0, CONFIG);

    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBe(0);
  });

  it('lets a behind-on-points closer keep scoring to win in a later turn', () => {
    const me = stateWith({ 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3, 25: 3 }, 40);
    const opp = stateWith({}, 80);
    const result = processTurn([dart(20, 3)], me, [me, opp], 0, CONFIG);

    expect(result.scoreDelta).toBe(60);
    expect(result.newState.points).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.winnerIndex).toBe(0);
  });
});
