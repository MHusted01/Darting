import {
  AROUND_THE_CLOCK_SLUG,
  BASEBALL_SLUG,
  BERMUDA_TRIANGLE_SLUG,
  BOBS_27_SLUG,
  CRICKET_SLUG,
  HALVE_IT_SLUG,
  HIGH_SCORE_SLUG,
  SHANGHAI_SLUG,
  X01_SLUG,
} from '@/constants/games';
import {
  getInitialPlayerState as getATCInitialState,
  processTurn as processATCTurn,
  type AroundTheClockConfig,
  type AroundTheClockPlayerState,
} from '@/lib/games/around-the-clock';
import {
  getInitialPlayerState as getCricketInitialState,
  processTurn as processCricketTurn,
  type CricketConfig,
  type CricketPlayerState,
} from '@/lib/games/cricket';
import {
  getInitialPlayerState as getX01InitialState,
  processTurn as processX01Turn,
  type X01Config,
  type X01PlayerState,
} from '@/lib/games/x01';
import {
  getInitialPlayerState as getShanghaiInitialState,
  processTurn as processShanghaiTurn,
  type ShanghaiPlayerState,
} from '@/lib/games/shanghai';
import {
  getInitialPlayerState as getBaseballInitialState,
  processTurn as processBaseballTurn,
  type BaseballPlayerState,
} from '@/lib/games/baseball';
import {
  getInitialPlayerState as getHighScoreInitialState,
  processTurn as processHighScoreTurn,
  type HighScorePlayerState,
} from '@/lib/games/high-score';
import {
  getInitialPlayerState as getHalveItInitialState,
  processTurn as processHalveItTurn,
  type HalveItPlayerState,
} from '@/lib/games/halve-it';
import {
  getInitialPlayerState as getBobs27InitialState,
  processTurn as processBobs27Turn,
  type Bobs27PlayerState,
} from '@/lib/games/bobs-27';
import {
  getInitialPlayerState as getBermudaTriangleInitialState,
  processTurn as processBermudaTriangleTurn,
  type BermudaTrianglePlayerState,
} from '@/lib/games/bermuda-triangle';
import type { DartThrow } from '@/types/game';

export interface ChallengeSettings {
  startingScore?: number;
  includeBull?: boolean;
}

export interface TurnBroadcastPayload {
  challengeId: string;
  turnSeq: number;
  userId: string;
  darts: DartThrow[];
  isComplete: boolean;
  winnerUserId: string | null;
  scores: Record<string, number>;
}

export interface TurnPlayerSnapshot {
  gameState: unknown;
  currentScore: number;
}

export interface AppliedTurn {
  newState: unknown;
  newScore: number;
  scoreDelta: number;
  isComplete: boolean;
  winnerIndex?: number | null;
}

export function buildTurnPayload(input: TurnBroadcastPayload): TurnBroadcastPayload {
  return {
    challengeId: input.challengeId,
    turnSeq: input.turnSeq,
    userId: input.userId,
    darts: input.darts.map((dart) => ({ segment: dart.segment, multiplier: dart.multiplier })),
    isComplete: input.isComplete,
    winnerUserId: input.winnerUserId,
    scores: { ...input.scores },
  };
}

function isValidDart(value: unknown): value is DartThrow {
  if (typeof value !== 'object' || value === null) return false;
  const dart = value as Record<string, unknown>;
  if (typeof dart.segment !== 'number' || typeof dart.multiplier !== 'number') return false;
  if (!Number.isInteger(dart.segment) || !Number.isInteger(dart.multiplier)) return false;
  if (dart.segment < 0 || (dart.segment > 20 && dart.segment !== 25)) return false;
  if (dart.multiplier < 0 || dart.multiplier > 3) return false;
  return true;
}

export function parseTurnPayload(value: unknown): TurnBroadcastPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.challengeId !== 'string' || raw.challengeId.length === 0) return null;
  if (typeof raw.turnSeq !== 'number' || !Number.isInteger(raw.turnSeq) || raw.turnSeq < 1) return null;
  if (typeof raw.userId !== 'string' || raw.userId.length === 0) return null;
  if (typeof raw.isComplete !== 'boolean') return null;
  if (raw.winnerUserId !== null && typeof raw.winnerUserId !== 'string') return null;

  if (!Array.isArray(raw.darts) || raw.darts.length < 1 || raw.darts.length > 3) return null;
  if (!raw.darts.every(isValidDart)) return null;

  if (typeof raw.scores !== 'object' || raw.scores === null || Array.isArray(raw.scores)) return null;
  const scores = raw.scores as Record<string, unknown>;
  if (!Object.values(scores).every((score) => typeof score === 'number')) return null;

  return {
    challengeId: raw.challengeId,
    turnSeq: raw.turnSeq,
    userId: raw.userId,
    darts: raw.darts.map((dart) => ({ segment: dart.segment, multiplier: dart.multiplier })),
    isComplete: raw.isComplete,
    winnerUserId: raw.winnerUserId,
    scores: { ...(scores as Record<string, number>) },
  };
}

export function configFromChallengeSettings(
  gameSlug: string,
  settings: ChallengeSettings,
): unknown {
  if (gameSlug === X01_SLUG) {
    const startingScore = settings.startingScore === 301 ? 301 : 501;
    return { startingScore } satisfies X01Config;
  }
  if (gameSlug === AROUND_THE_CLOCK_SLUG) {
    return { includeBull: settings.includeBull === true } satisfies AroundTheClockConfig;
  }
  if (gameSlug === CRICKET_SLUG) {
    return { variant: 'standard' } satisfies CricketConfig;
  }
  return {};
}

export function initialStateForSlug(gameSlug: string, config: unknown): unknown {
  switch (gameSlug) {
    case X01_SLUG:
      return getX01InitialState(config as X01Config);
    case AROUND_THE_CLOCK_SLUG:
      return getATCInitialState();
    case CRICKET_SLUG:
      return getCricketInitialState();
    case SHANGHAI_SLUG:
      return getShanghaiInitialState();
    case BASEBALL_SLUG:
      return getBaseballInitialState();
    case HIGH_SCORE_SLUG:
      return getHighScoreInitialState();
    case HALVE_IT_SLUG:
      return getHalveItInitialState();
    case BOBS_27_SLUG:
      return getBobs27InitialState();
    case BERMUDA_TRIANGLE_SLUG:
      return getBermudaTriangleInitialState();
    default:
      throw new Error(`Unsupported challenge game: ${gameSlug}`);
  }
}

export function applyGameTurn(
  gameSlug: string,
  config: unknown,
  players: TurnPlayerSnapshot[],
  currentPlayerIndex: number,
  darts: DartThrow[],
): AppliedTurn {
  const currentPlayer = players[currentPlayerIndex];
  if (!currentPlayer) {
    throw new Error(`Invalid player index: ${currentPlayerIndex}`);
  }

  if (gameSlug === X01_SLUG) {
    const x01Config = config as X01Config;
    const result = processX01Turn(darts, currentPlayer.gameState as X01PlayerState, x01Config);
    return {
      newState: result.newState,
      newScore: x01Config.startingScore - result.newState.remaining,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: undefined,
    };
  }

  if (gameSlug === AROUND_THE_CLOCK_SLUG) {
    const result = processATCTurn(
      darts,
      currentPlayer.gameState as AroundTheClockPlayerState,
      config as AroundTheClockConfig,
    );
    return {
      newState: result.newState,
      newScore: currentPlayer.currentScore + result.scoreDelta,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: undefined,
    };
  }

  if (gameSlug === CRICKET_SLUG) {
    const allStates = players.map((player) => player.gameState as CricketPlayerState);
    const result = processCricketTurn(
      darts,
      currentPlayer.gameState as CricketPlayerState,
      allStates,
      currentPlayerIndex,
      config as CricketConfig,
    );
    return {
      newState: result.newState,
      newScore: result.newState.points,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: result.isComplete && result.winnerIndex !== null ? result.winnerIndex : undefined,
    };
  }

  if (gameSlug === SHANGHAI_SLUG) {
    const allStates = players.map((player) => player.gameState as ShanghaiPlayerState);
    const result = processShanghaiTurn(
      darts,
      currentPlayer.gameState as ShanghaiPlayerState,
      allStates,
      currentPlayerIndex,
    );
    return {
      newState: result.newState,
      newScore: result.newState.totalScore,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: result.isComplete ? result.winnerIndex : undefined,
    };
  }

  if (gameSlug === BASEBALL_SLUG) {
    const allStates = players.map((player) => player.gameState as BaseballPlayerState);
    const result = processBaseballTurn(
      darts,
      currentPlayer.gameState as BaseballPlayerState,
      allStates,
      currentPlayerIndex,
    );
    return {
      newState: result.newState,
      newScore: result.newState.totalRuns,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: result.isComplete ? result.winnerIndex : undefined,
    };
  }

  if (gameSlug === HIGH_SCORE_SLUG) {
    const allStates = players.map((player) => player.gameState as HighScorePlayerState);
    const result = processHighScoreTurn(
      darts,
      currentPlayer.gameState as HighScorePlayerState,
      allStates,
      currentPlayerIndex,
    );
    return {
      newState: result.newState,
      newScore: result.newState.totalScore,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: result.isComplete ? result.winnerIndex : undefined,
    };
  }

  if (gameSlug === HALVE_IT_SLUG) {
    const allStates = players.map((player) => player.gameState as HalveItPlayerState);
    const result = processHalveItTurn(
      darts,
      currentPlayer.gameState as HalveItPlayerState,
      allStates,
      currentPlayerIndex,
    );
    return {
      newState: result.newState,
      newScore: result.newState.score,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: result.isComplete ? result.winnerIndex : undefined,
    };
  }

  if (gameSlug === BOBS_27_SLUG) {
    const allStates = players.map((player) => player.gameState as Bobs27PlayerState);
    const result = processBobs27Turn(
      darts,
      currentPlayer.gameState as Bobs27PlayerState,
      allStates,
      currentPlayerIndex,
    );
    return {
      newState: result.newState,
      newScore: result.newState.score,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: result.isComplete ? result.winnerIndex : undefined,
    };
  }

  if (gameSlug === BERMUDA_TRIANGLE_SLUG) {
    const allStates = players.map((player) => player.gameState as BermudaTrianglePlayerState);
    const result = processBermudaTriangleTurn(
      darts,
      currentPlayer.gameState as BermudaTrianglePlayerState,
      allStates,
      currentPlayerIndex,
    );
    return {
      newState: result.newState,
      newScore: result.newState.totalScore,
      scoreDelta: result.scoreDelta,
      isComplete: result.isComplete,
      winnerIndex: result.isComplete ? result.winnerIndex : undefined,
    };
  }

  throw new Error(`Unsupported challenge game: ${gameSlug}`);
}
