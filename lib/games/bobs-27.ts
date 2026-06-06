import type { DartThrow } from '@/types/game';

export const BOBS_27_MAX_ROUNDS = 20;

export type Bobs27Config = Record<string, never>;

export type Bobs27PlayerState = {
  score: number;
  currentRound: number; // 1–20 (round N targets double-N)
  eliminated: boolean;
};

export type Bobs27TurnResult = {
  newState: Bobs27PlayerState;
  scoreDelta: number;
  isComplete: boolean;
  winnerIndex: number | null;
};

export function getInitialPlayerState(): Bobs27PlayerState {
  return { score: 27, currentRound: 1, eliminated: false };
}

function resolveGameEnd(
  newState: Bobs27PlayerState,
  allPlayerStates: Bobs27PlayerState[],
  currentPlayerIndex: number,
  scoreDelta: number,
): Bobs27TurnResult | null {
  const allOthersDone = allPlayerStates.every(
    (s, i) => i === currentPlayerIndex || s.currentRound > BOBS_27_MAX_ROUNDS,
  );

  if (newState.currentRound > BOBS_27_MAX_ROUNDS && allOthersDone) {
    const allNewStates = allPlayerStates.map((s, i) =>
      i === currentPlayerIndex ? newState : s,
    );
    const maxScore = Math.max(...allNewStates.map((s) => s.score));
    const tied = allNewStates.filter((s) => s.score === maxScore).length > 1;
    const winnerIndex = tied
      ? null
      : allNewStates.findIndex((s) => s.score === maxScore);
    return { newState, scoreDelta, isComplete: true, winnerIndex };
  }

  return null;
}

export function processTurn(
  darts: DartThrow[],
  playerState: Bobs27PlayerState,
  allPlayerStates: Bobs27PlayerState[],
  currentPlayerIndex: number,
): Bobs27TurnResult {
  if (playerState.eliminated) {
    const newState: Bobs27PlayerState = {
      ...playerState,
      currentRound: playerState.currentRound + 1,
    };
    return (
      resolveGameEnd(newState, allPlayerStates, currentPlayerIndex, 0) ?? {
        newState,
        scoreDelta: 0,
        isComplete: false,
        winnerIndex: null,
      }
    );
  }

  const targetSegment = playerState.currentRound;
  const doublesHit = darts.filter(
    (d) => d.segment === targetSegment && d.multiplier === 2,
  ).length;

  const reward = doublesHit * 2 * targetSegment;
  const penalty = 2 * targetSegment;

  let scoreDelta: number;
  let newScore: number;
  let eliminated = false;

  if (doublesHit > 0) {
    scoreDelta = reward;
    newScore = playerState.score + reward;
  } else {
    scoreDelta = -penalty;
    newScore = playerState.score - penalty;
    if (newScore <= 0) {
      newScore = 0;
      eliminated = true;
    }
  }

  const newState: Bobs27PlayerState = {
    score: newScore,
    currentRound: playerState.currentRound + 1,
    eliminated,
  };

  return (
    resolveGameEnd(newState, allPlayerStates, currentPlayerIndex, scoreDelta) ?? {
      newState,
      scoreDelta,
      isComplete: false,
      winnerIndex: null,
    }
  );
}
