import type { DartThrow } from '@/types/game';

export const SHANGHAI_MAX_ROUNDS = 7;

export type ShanghaiConfig = Record<string, never>;

export type ShanghaiPlayerState = {
  totalScore: number;
  currentRound: number; // 1–7
};

export type ShanghaiTurnResult = {
  newState: ShanghaiPlayerState;
  scoreDelta: number;
  isComplete: boolean;
  isShanghai: boolean;
  winnerIndex: number | null;
};

export function getInitialPlayerState(): ShanghaiPlayerState {
  return { totalScore: 0, currentRound: 1 };
}

export function processTurn(
  darts: DartThrow[],
  playerState: ShanghaiPlayerState,
  allPlayerStates: ShanghaiPlayerState[],
  currentPlayerIndex: number,
): ShanghaiTurnResult {
  const targetSegment = playerState.currentRound;

  const roundScore = darts.reduce((sum, dart) => {
    if (dart.segment === targetSegment) {
      return sum + dart.segment * dart.multiplier;
    }
    return sum;
  }, 0);

  const hitSingle = darts.some(
    (d) => d.segment === targetSegment && d.multiplier === 1,
  );
  const hitDouble = darts.some(
    (d) => d.segment === targetSegment && d.multiplier === 2,
  );
  const hitTriple = darts.some(
    (d) => d.segment === targetSegment && d.multiplier === 3,
  );
  const isShanghai = hitSingle && hitDouble && hitTriple;

  const newState: ShanghaiPlayerState = {
    totalScore: playerState.totalScore + roundScore,
    currentRound: playerState.currentRound + 1,
  };

  if (isShanghai) {
    return {
      newState,
      scoreDelta: roundScore,
      isComplete: true,
      isShanghai: true,
      winnerIndex: currentPlayerIndex,
    };
  }

  const nextRound = newState.currentRound;
  const allOthersDone = allPlayerStates.every(
    (s, i) => i === currentPlayerIndex || s.currentRound > SHANGHAI_MAX_ROUNDS,
  );

  if (nextRound > SHANGHAI_MAX_ROUNDS && allOthersDone) {
    const allNewStates = allPlayerStates.map((s, i) =>
      i === currentPlayerIndex ? newState : s,
    );
    const maxScore = Math.max(...allNewStates.map((s) => s.totalScore));
    const tied = allNewStates.filter((s) => s.totalScore === maxScore).length > 1;
    const winnerIndex = tied
      ? null
      : allNewStates.findIndex((s) => s.totalScore === maxScore);
    return {
      newState,
      scoreDelta: roundScore,
      isComplete: true,
      isShanghai: false,
      winnerIndex,
    };
  }

  return {
    newState,
    scoreDelta: roundScore,
    isComplete: false,
    isShanghai: false,
    winnerIndex: null,
  };
}
