import type { DartThrow } from '@/types/game';

export const BASEBALL_MAX_INNINGS = 9;

export type BaseballConfig = Record<string, never>;

export type BaseballPlayerState = {
  totalRuns: number;
  currentInning: number; // 1–9
};

export type BaseballTurnResult = {
  newState: BaseballPlayerState;
  scoreDelta: number;
  isComplete: boolean;
  winnerIndex: number | null;
};

export function getInitialPlayerState(): BaseballPlayerState {
  return { totalRuns: 0, currentInning: 1 };
}

export function processTurn(
  darts: DartThrow[],
  playerState: BaseballPlayerState,
  allPlayerStates: BaseballPlayerState[],
  currentPlayerIndex: number,
): BaseballTurnResult {
  const targetSegment = playerState.currentInning;

  // single=1 run, double=2 runs, triple=3 runs for darts hitting target segment
  const runs = darts.reduce((sum, dart) => {
    if (dart.segment === targetSegment) {
      return sum + dart.multiplier;
    }
    return sum;
  }, 0);

  const newState: BaseballPlayerState = {
    totalRuns: playerState.totalRuns + runs,
    currentInning: playerState.currentInning + 1,
  };

  const nextInning = newState.currentInning;
  const allOthersDone = allPlayerStates.every(
    (s, i) =>
      i === currentPlayerIndex || s.currentInning > BASEBALL_MAX_INNINGS,
  );

  if (nextInning > BASEBALL_MAX_INNINGS && allOthersDone) {
    const allNewStates = allPlayerStates.map((s, i) =>
      i === currentPlayerIndex ? newState : s,
    );
    const maxRuns = Math.max(...allNewStates.map((s) => s.totalRuns));
    const tied = allNewStates.filter((s) => s.totalRuns === maxRuns).length > 1;
    const winnerIndex = tied ? null : allNewStates.findIndex((s) => s.totalRuns === maxRuns);
    return { newState, scoreDelta: runs, isComplete: true, winnerIndex };
  }

  return { newState, scoreDelta: runs, isComplete: false, winnerIndex: null };
}
