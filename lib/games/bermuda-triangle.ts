import type { DartThrow } from '@/types/game';

export const BERMUDA_TRIANGLE_TARGETS: readonly number[] = [
  12, 13, 14, 25, 15, 16, 17, 25, 18, 19, 20, 25,
];

export const BERMUDA_TRIANGLE_MAX_ROUNDS = BERMUDA_TRIANGLE_TARGETS.length;

export type BermudaTriangleConfig = Record<string, never>;

export type BermudaTrianglePlayerState = {
  totalScore: number;
  currentRound: number;
};

export type BermudaTriangleTurnResult = {
  newState: BermudaTrianglePlayerState;
  scoreDelta: number;
  isComplete: boolean;
  winnerIndex: number | null;
};

export function getInitialPlayerState(): BermudaTrianglePlayerState {
  return { totalScore: 0, currentRound: 1 };
}

export function processTurn(
  darts: DartThrow[],
  playerState: BermudaTrianglePlayerState,
  allPlayerStates: BermudaTrianglePlayerState[],
  currentPlayerIndex: number,
): BermudaTriangleTurnResult {
  const target = BERMUDA_TRIANGLE_TARGETS[playerState.currentRound - 1];

  const scoreDelta = darts.reduce((sum, dart) => {
    if (dart.segment !== target) return sum;
    return sum + dart.segment * dart.multiplier;
  }, 0);

  const newState: BermudaTrianglePlayerState = {
    totalScore: playerState.totalScore + scoreDelta,
    currentRound: playerState.currentRound + 1,
  };

  const allOthersDone = allPlayerStates.every(
    (s, i) => i === currentPlayerIndex || s.currentRound > BERMUDA_TRIANGLE_MAX_ROUNDS,
  );

  if (newState.currentRound > BERMUDA_TRIANGLE_MAX_ROUNDS && allOthersDone) {
    const allNewStates = allPlayerStates.map((s, i) =>
      i === currentPlayerIndex ? newState : s,
    );
    const maxScore = Math.max(...allNewStates.map((s) => s.totalScore));
    const tied = allNewStates.filter((s) => s.totalScore === maxScore).length > 1;
    const winnerIndex = tied ? null : allNewStates.findIndex((s) => s.totalScore === maxScore);
    return { newState, scoreDelta, isComplete: true, winnerIndex };
  }

  return { newState, scoreDelta, isComplete: false, winnerIndex: null };
}
