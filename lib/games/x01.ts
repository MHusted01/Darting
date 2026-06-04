import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored in gameSessions.config */
export interface X01Config {
  startingScore: 501 | 301;
}

/** Stored in gamePlayers.gameState */
export interface X01PlayerState {
  remaining: number;
}

export interface X01TurnResult {
  newState: X01PlayerState;
  /** Points scored this turn (0 on bust). */
  scoreDelta: number;
  /** Player checked out — remaining hit exactly 0 with a double. */
  isComplete: boolean;
  /** Turn busted — score reverted to start-of-turn remaining. */
  isBust: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getInitialPlayerState(config: X01Config): X01PlayerState {
  return { remaining: config.startingScore };
}

function isDouble(dart: DartThrow): boolean {
  return dart.multiplier === 2;
}

function dartScore(dart: DartThrow): number {
  return dart.segment * dart.multiplier;
}

// ---------------------------------------------------------------------------
// Turn processing
// ---------------------------------------------------------------------------

/**
 * Process a turn of up to 3 darts under standard X01 double-out rules.
 *
 * Darts are evaluated in order. Processing stops early on checkout or bust.
 * A bust occurs when:
 *   - remaining would go below 0
 *   - remaining would hit exactly 1 (unreachable checkout)
 *   - remaining would hit 0 but the dart is not a double
 *
 * On bust the score reverts to the start-of-turn remaining (scoreDelta = 0).
 */
export function processTurn(
  darts: DartThrow[],
  playerState: X01PlayerState,
  _config: X01Config,
): X01TurnResult {
  const startRemaining = playerState.remaining;
  let remaining = startRemaining;
  let scored = 0;

  for (const dart of darts) {
    const score = dartScore(dart);
    const next = remaining - score;

    // Bust conditions
    if (next < 0 || next === 1 || (next === 0 && !isDouble(dart))) {
      return {
        newState: { remaining: startRemaining },
        scoreDelta: 0,
        isComplete: false,
        isBust: true,
      };
    }

    remaining = next;
    scored += score;

    // Checkout
    if (remaining === 0) {
      return {
        newState: { remaining: 0 },
        scoreDelta: scored,
        isComplete: true,
        isBust: false,
      };
    }
  }

  return {
    newState: { remaining },
    scoreDelta: scored,
    isComplete: false,
    isBust: false,
  };
}
