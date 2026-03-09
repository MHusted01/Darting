import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CRICKET_SEGMENTS = [15, 16, 17, 18, 19, 20, 25] as const;
export type CricketSegment = (typeof CRICKET_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored in gameSessions.config */
export interface CricketConfig {
  variant: 'standard'; // future: 'cutthroat' | 'no_score'
}

/** Marks per cricket segment */
export type SegmentMarks = Record<CricketSegment, number>;

/** Stored in gamePlayers.gameState */
export interface CricketPlayerState {
  marks: SegmentMarks;
  points: number;
}

export interface CricketTurnResult {
  newState: CricketPlayerState;
  scoreDelta: number;
  isComplete: boolean;
  winnerIndex: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getInitialPlayerState(): CricketPlayerState {
  const marks = {} as SegmentMarks;
  for (const seg of CRICKET_SEGMENTS) {
    marks[seg] = 0;
  }
  return { marks, points: 0 };
}

export function isSegmentClosed(marks: number): boolean {
  return marks >= 3;
}

export function areAllSegmentsClosed(state: CricketPlayerState): boolean {
  return CRICKET_SEGMENTS.every((seg) => isSegmentClosed(state.marks[seg]));
}

export function isCricketSegment(segment: number): segment is CricketSegment {
  return (CRICKET_SEGMENTS as readonly number[]).includes(segment);
}

export function getSegmentLabel(segment: CricketSegment): string {
  return segment === 25 ? 'Bull' : String(segment);
}

/**
 * Extract mark info from a single dart throw.
 * Returns null segment if the dart missed or hit a non-cricket segment.
 */
export function getMarksFromDart(dart: DartThrow): {
  segment: CricketSegment | null;
  marks: number;
} {
  if (dart.multiplier === 0 || dart.segment === 0) {
    return { segment: null, marks: 0 };
  }
  if (!isCricketSegment(dart.segment)) {
    return { segment: null, marks: 0 };
  }
  if (dart.segment === 25 && dart.multiplier > 2) {
    // Triple bull is not valid in Cricket.
    return { segment: null, marks: 0 };
  }
  return { segment: dart.segment, marks: dart.multiplier };
}

// ---------------------------------------------------------------------------
// Game completion
// ---------------------------------------------------------------------------

/**
 * Check whether the game should end given all player states.
 *
 * A player wins when they have closed all 7 segments AND have a score
 * greater than or equal to every opponent.
 *
 * If all players have closed all segments the highest score wins.
 */
export function checkGameComplete(
  allPlayerStates: CricketPlayerState[],
): { isComplete: boolean; winnerIndex: number | null } {
  const closedAll = allPlayerStates.map((ps) => areAllSegmentsClosed(ps));

  for (let i = 0; i < allPlayerStates.length; i++) {
    if (!closedAll[i]) continue;

    const playerPoints = allPlayerStates[i].points;
    const leadsOrTied = allPlayerStates.every(
      (ps, j) => j === i || playerPoints >= ps.points,
    );

    if (leadsOrTied) {
      return { isComplete: true, winnerIndex: i };
    }
  }

  // All segments closed by everyone → highest score wins
  if (closedAll.every(Boolean)) {
    let maxPoints = -1;
    let winnerIdx = 0;
    for (let i = 0; i < allPlayerStates.length; i++) {
      if (allPlayerStates[i].points > maxPoints) {
        maxPoints = allPlayerStates[i].points;
        winnerIdx = i;
      }
    }
    return { isComplete: true, winnerIndex: winnerIdx };
  }

  return { isComplete: false, winnerIndex: null };
}

// ---------------------------------------------------------------------------
// Turn processing
// ---------------------------------------------------------------------------

/**
 * Process a set of darts for the current player.
 *
 * Unlike Around the Clock, Cricket scoring depends on all player states
 * because points are only awarded when the current player has closed a
 * segment but at least one opponent has not.
 */
export function processTurn(
  darts: DartThrow[],
  currentPlayerState: CricketPlayerState,
  allPlayerStates: CricketPlayerState[],
  currentPlayerIndex: number,
  _config: CricketConfig,
): CricketTurnResult {
  const newMarks = { ...currentPlayerState.marks };
  let pointsGained = 0;

  for (const dart of darts) {
    const { segment, marks: dartMarks } = getMarksFromDart(dart);
    if (segment === null || dartMarks === 0) continue;

    const previousMarks = newMarks[segment];

    // Check if any opponent has NOT closed this segment
    const opponentsAllClosed = allPlayerStates.every(
      (ps, i) => i === currentPlayerIndex || isSegmentClosed(ps.marks[segment]),
    );

    if (previousMarks >= 3) {
      // Already closed by current player — score if opponents haven't all closed
      if (!opponentsAllClosed) {
        pointsGained += segment * dartMarks;
      }
    } else {
      // Not yet closed — apply marks
      const marksToClose = 3 - previousMarks;
      const marksApplied = Math.min(dartMarks, marksToClose);
      const excessMarks = dartMarks - marksApplied;

      newMarks[segment] = previousMarks + marksApplied;

      // Excess marks on the closing hit score points
      if (excessMarks > 0 && newMarks[segment] >= 3 && !opponentsAllClosed) {
        pointsGained += segment * excessMarks;
      }
    }
  }

  const totalPoints = currentPlayerState.points + pointsGained;
  const newState: CricketPlayerState = { marks: newMarks, points: totalPoints };

  // Check game completion with the updated state
  const updatedAllStates = allPlayerStates.map((ps, i) =>
    i === currentPlayerIndex ? newState : ps,
  );
  const { isComplete, winnerIndex } = checkGameComplete(updatedAllStates);

  return { newState, scoreDelta: pointsGained, isComplete, winnerIndex };
}
