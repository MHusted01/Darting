import type { DartThrow } from '@/types/game';

export const HIGH_SCORE_MAX_ROUNDS = 10;

export type HighScoreConfig = Record<string, never>;

export type HighScorePlayerState = {
  totalScore: number;
  currentRound: number; // 1–10
};

export type HighScoreTurnResult = {
  newState: HighScorePlayerState;
  scoreDelta: number;
  isComplete: boolean;
  winnerIndex: number | null;
};

export function getInitialPlayerState(): HighScorePlayerState {
  return { totalScore: 0, currentRound: 1 };
}

export function processTurn(
  darts: DartThrow[],
  playerState: HighScorePlayerState,
  allPlayerStates: HighScorePlayerState[],
  currentPlayerIndex: number,
): HighScoreTurnResult {
  const roundScore = darts.reduce(
    (sum, dart) => sum + dart.segment * dart.multiplier,
    0,
  );

  const newState: HighScorePlayerState = {
    totalScore: playerState.totalScore + roundScore,
    currentRound: playerState.currentRound + 1,
  };

  const allOthersDone = allPlayerStates.every(
    (s, i) =>
      i === currentPlayerIndex || s.currentRound > HIGH_SCORE_MAX_ROUNDS,
  );

  if (newState.currentRound > HIGH_SCORE_MAX_ROUNDS && allOthersDone) {
    const allNewStates = allPlayerStates.map((s, i) =>
      i === currentPlayerIndex ? newState : s,
    );
    const maxScore = Math.max(...allNewStates.map((s) => s.totalScore));
    const tied = allNewStates.filter((s) => s.totalScore === maxScore).length > 1;
    const winnerIndex = tied ? null : allNewStates.findIndex((s) => s.totalScore === maxScore);
    return { newState, scoreDelta: roundScore, isComplete: true, winnerIndex };
  }

  return { newState, scoreDelta: roundScore, isComplete: false, winnerIndex: null };
}
