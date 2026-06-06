import type { DartThrow } from '@/types/game';

export type KillerPlayerState = {
  assignedNumber: number | null;
  isKiller: boolean;
  lives: number;
  isEliminated: boolean;
};

export type KillerTurnResult = {
  updatedPlayerStates: KillerPlayerState[];
  scoreDelta: number;
  isComplete: boolean;
  winnerIndex: number | null;
};

export function getInitialPlayerState(): KillerPlayerState {
  return { assignedNumber: null, isKiller: false, lives: 3, isEliminated: false };
}

export function derivePhase(states: KillerPlayerState[]): 'assign' | 'play' {
  return states.some((s) => s.assignedNumber === null) ? 'assign' : 'play';
}

export function getNextPlayerIndex(
  states: KillerPlayerState[],
  currentIndex: number,
): number {
  const count = states.length;
  for (let i = 1; i <= count; i++) {
    const idx = (currentIndex + i) % count;
    if (!states[idx].isEliminated) return idx;
  }
  return currentIndex;
}

function lowestAvailable(taken: Set<number>): number {
  for (let n = 1; n <= 20; n++) {
    if (!taken.has(n)) return n;
  }
  return 1;
}

function processAssignTurn(
  darts: DartThrow[],
  states: KillerPlayerState[],
  currentIndex: number,
  takenNumbers: Set<number>,
): KillerPlayerState[] {
  let assigned: number | null = null;
  for (const dart of darts) {
    if (dart.segment >= 1 && dart.segment <= 20 && !takenNumbers.has(dart.segment)) {
      assigned = dart.segment;
      break;
    }
  }
  if (assigned === null) {
    assigned = lowestAvailable(takenNumbers);
  }
  return states.map((s, i) =>
    i === currentIndex ? { ...s, assignedNumber: assigned } : s,
  );
}

function processPlayTurn(
  darts: DartThrow[],
  states: KillerPlayerState[],
  currentIndex: number,
): KillerPlayerState[] {
  const current = states[currentIndex];
  let updatedStates = states.map((s) => ({ ...s }));

  if (!current.isKiller) {
    const earnedKiller = darts.some(
      (d) => d.multiplier === 2 && d.segment === current.assignedNumber,
    );
    if (earnedKiller) {
      updatedStates[currentIndex] = { ...updatedStates[currentIndex], isKiller: true };
    }
    return updatedStates;
  }

  for (const dart of darts) {
    if (dart.multiplier !== 2) continue;
    const victimIndex = updatedStates.findIndex(
      (s, i) => i !== currentIndex && s.assignedNumber === dart.segment && !s.isEliminated,
    );
    if (victimIndex !== -1) {
      const newLives = updatedStates[victimIndex].lives - 1;
      updatedStates[victimIndex] = {
        ...updatedStates[victimIndex],
        lives: newLives,
        isEliminated: newLives <= 0,
      };
    } else if (dart.segment === current.assignedNumber) {
      const newLives = updatedStates[currentIndex].lives - 1;
      updatedStates[currentIndex] = {
        ...updatedStates[currentIndex],
        lives: newLives,
        isEliminated: newLives <= 0,
      };
    }
  }

  return updatedStates;
}

export function processTurn(
  darts: DartThrow[],
  allPlayerStates: KillerPlayerState[],
  currentPlayerIndex: number,
  takenNumbers: Set<number>,
): KillerTurnResult {
  const phase = derivePhase(allPlayerStates);

  const updatedPlayerStates =
    phase === 'assign'
      ? processAssignTurn(darts, allPlayerStates, currentPlayerIndex, takenNumbers)
      : processPlayTurn(darts, allPlayerStates, currentPlayerIndex);

  const active = updatedPlayerStates.filter((s) => !s.isEliminated);
  const isComplete = phase === 'play' && active.length <= 1;
  const winnerIndex =
    isComplete && active.length === 1
      ? updatedPlayerStates.findIndex((s) => !s.isEliminated)
      : null;

  return {
    updatedPlayerStates,
    scoreDelta: 0,
    isComplete,
    winnerIndex,
  };
}
