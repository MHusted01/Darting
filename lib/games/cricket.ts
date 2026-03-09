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
/**
 * Create a new player state with all cricket segments initialized to zero marks and zero points.
 *
 * @returns A CricketPlayerState whose `marks` map has 0 for every cricket segment and `points` equal to 0.
 */

export function getInitialPlayerState(): CricketPlayerState {
  const marks = {} as SegmentMarks;
  for (const seg of CRICKET_SEGMENTS) {
    marks[seg] = 0;
  }
  return { marks, points: 0 };
}

/**
 * Determine whether a segment is closed.
 *
 * @param marks - The number of marks recorded on the segment
 * @returns `true` if the segment has three or more marks, `false` otherwise
 */
export function isSegmentClosed(marks: number): boolean {
  return marks >= 3;
}

/**
 * Determine whether the given player's state has all cricket segments closed.
 *
 * @param state - The player's cricket state containing `marks` for each segment
 * @returns `true` if every cricket segment has three or more marks, `false` otherwise
 */
export function areAllSegmentsClosed(state: CricketPlayerState): boolean {
  return CRICKET_SEGMENTS.every((seg) => isSegmentClosed(state.marks[seg]));
}

/**
 * Determines whether a numeric segment is one of the valid cricket targets (15, 16, 17, 18, 19, 20, 25).
 *
 * @param segment - The numeric segment to check
 * @returns `true` if `segment` is a valid cricket segment, `false` otherwise.
 */
export function isCricketSegment(segment: number): segment is CricketSegment {
  return (CRICKET_SEGMENTS as readonly number[]).includes(segment);
}

/**
 * Get the display label for a cricket segment.
 *
 * @returns The string `'Bull'` if `segment` is 25, otherwise the numeric segment as a string.
 */
export function getSegmentLabel(segment: CricketSegment): string {
  return segment === 25 ? 'Bull' : String(segment);
}

/**
 * Convert a DartThrow into cricket scoring information for that dart.
 *
 * @param dart - The thrown dart to evaluate.
 * @returns An object with `segment` set to the hit cricket segment or `null` for a miss/non-cricket/invalid hit, and `marks` set to the multiplier applied (0 if no marks).
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
 * Determine whether the cricket game has finished and, if so, which player won.
 *
 * A player wins if they have closed all cricket segments and have points greater than or equal to every opponent.
 * If every player has closed all segments, the player with the highest points wins.
 *
 * @param allPlayerStates - Array of player states for all players in the game, indexed by player order
 * @returns An object with `isComplete` set to `true` when a winner has been determined and `winnerIndex` set to the winning player's index, or `isComplete: false` and `winnerIndex: null` when the game is not finished
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
 * Apply a sequence of dart throws for the current player, updating their marks and awarding points according to Cricket rules.
 *
 * Processes each dart, updates the player's segment marks, adds points when appropriate (including excess marks on a closing hit or hits to already closed segments when opponents haven't closed the segment), and determines whether the game is complete.
 *
 * @returns An object containing `newState` (the updated CricketPlayerState), `scoreDelta` (points gained this turn), `isComplete` (`true` if the game has ended), and `winnerIndex` (index of the winning player or `null`)
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
