import type { DartThrow } from '@/types/game';

export type HalveItTarget = number | 'bull' | 'doubles' | 'triples';

export const HALVE_IT_TARGETS: readonly HalveItTarget[] = [
  20, 19, 18, 17, 16, 15, 'bull', 'doubles', 'triples',
] as const;

export const HALVE_IT_MAX_ROUNDS = HALVE_IT_TARGETS.length; // 9

export type HalveItConfig = Record<string, never>;

export type HalveItPlayerState = {
  score: number;
  currentRound: number; // 1–9
};

export type HalveItTurnResult = {
  newState: HalveItPlayerState;
  scoreDelta: number;
  halved: boolean;
  isComplete: boolean;
  winnerIndex: number | null;
};

export function getInitialPlayerState(): HalveItPlayerState {
  return { score: 40, currentRound: 1 };
}

function dartHitsTarget(dart: DartThrow, target: HalveItTarget): boolean {
  if (target === 'bull') return dart.segment === 25;
  if (target === 'doubles') return dart.multiplier === 2;
  if (target === 'triples') return dart.multiplier === 3;
  return dart.segment === target;
}

function dartScoreForTarget(dart: DartThrow, target: HalveItTarget): number {
  if (target === 'bull') return dart.segment === 25 ? dart.segment * dart.multiplier : 0;
  if (target === 'doubles') return dart.multiplier === 2 ? dart.segment * dart.multiplier : 0;
  if (target === 'triples') return dart.multiplier === 3 ? dart.segment * dart.multiplier : 0;
  return dart.segment === target ? dart.segment * dart.multiplier : 0;
}

export function processTurn(
  darts: DartThrow[],
  playerState: HalveItPlayerState,
  allPlayerStates: HalveItPlayerState[],
  currentPlayerIndex: number,
): HalveItTurnResult {
  const target = HALVE_IT_TARGETS[playerState.currentRound - 1];
  const anyHit = darts.some((d) => dartHitsTarget(d, target));

  let newScore: number;
  let scoreDelta: number;
  let halved: boolean;

  if (anyHit) {
    const earned = darts.reduce(
      (sum, d) => sum + dartScoreForTarget(d, target),
      0,
    );
    newScore = playerState.score + earned;
    scoreDelta = earned;
    halved = false;
  } else {
    const halvedScore = Math.max(1, Math.floor(playerState.score / 2));
    scoreDelta = halvedScore - playerState.score; // negative
    newScore = halvedScore;
    halved = true;
  }

  const newState: HalveItPlayerState = {
    score: newScore,
    currentRound: playerState.currentRound + 1,
  };

  const allOthersDone = allPlayerStates.every(
    (s, i) =>
      i === currentPlayerIndex || s.currentRound > HALVE_IT_MAX_ROUNDS,
  );

  if (newState.currentRound > HALVE_IT_MAX_ROUNDS && allOthersDone) {
    const allNewStates = allPlayerStates.map((s, i) =>
      i === currentPlayerIndex ? newState : s,
    );
    const maxScore = Math.max(...allNewStates.map((s) => s.score));
    const tied = allNewStates.filter((s) => s.score === maxScore).length > 1;
    const winnerIndex = tied ? null : allNewStates.findIndex((s) => s.score === maxScore);
    return { newState, scoreDelta, halved, isComplete: true, winnerIndex };
  }

  return { newState, scoreDelta, halved, isComplete: false, winnerIndex: null };
}
