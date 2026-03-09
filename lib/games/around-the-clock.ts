import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored in gameSessions.config */
export interface AroundTheClockConfig {
  includeBull: boolean;
}

/** Stored in gamePlayers.gameState */
export interface AroundTheClockPlayerState {
  currentTarget: number; // 1–20, or up to 21 when includeBull
}

export interface TurnResult {
  newState: AroundTheClockPlayerState;
  scoreDelta: number; // how many targets advanced this turn
  isComplete: boolean; // did the player finish?
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The highest target number a player must hit to win. */
export function getMaxTarget(config: AroundTheClockConfig): number {
  return config.includeBull ? 21 : 20;
}

/** Map a logical target (1–21) to the board segment number. */
export function getTargetSegment(target: number): number {
  return target === 21 ? 25 : target;
}

/** Fresh state for a player joining the game. */
export function getInitialPlayerState(): AroundTheClockPlayerState {
  return { currentTarget: 1 };
}

/** Display label for a target number. */
export function getTargetLabel(target: number): string {
  return target === 21 ? 'Bull' : String(target);
}

// ---------------------------------------------------------------------------
// Turn processing
// ---------------------------------------------------------------------------

/**
 * Process a single turn (up to 3 darts) for one player.
 *
 * Darts are evaluated in order. Each hit on the current target advances it.
 * Multiple advances per turn are possible. Processing stops early if the
 * player completes the game.
 */
export function processTurn(
  darts: DartThrow[],
  playerState: AroundTheClockPlayerState,
  config: AroundTheClockConfig,
): TurnResult {
  const maxTarget = getMaxTarget(config);
  let currentTarget = playerState.currentTarget;
  const startTarget = currentTarget;

  for (const dart of darts) {
    if (currentTarget > maxTarget) break;

    const targetSegment = getTargetSegment(currentTarget);

    if (dart.segment === targetSegment && dart.multiplier > 0) {
      currentTarget++;
    }
  }

  return {
    newState: { currentTarget },
    scoreDelta: currentTarget - startTarget,
    isComplete: currentTarget > maxTarget,
  };
}
