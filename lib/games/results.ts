import {
  getMaxTarget,
  type AroundTheClockConfig,
  type AroundTheClockPlayerState,
} from '@/lib/games/around-the-clock';
import {
  CRICKET_SEGMENTS,
  getMarksFromDart,
  isSegmentClosed,
  type CricketPlayerState,
} from '@/lib/games/cricket';
import type { X01Config, X01PlayerState } from '@/lib/games/x01';
import type { ShanghaiPlayerState } from '@/lib/games/shanghai';
import type { BaseballPlayerState } from '@/lib/games/baseball';
import type { HighScorePlayerState } from '@/lib/games/high-score';
import type { HalveItPlayerState } from '@/lib/games/halve-it';
import type { Bobs27PlayerState } from '@/lib/games/bobs-27';
import type { DartThrow } from '@/types/game';

export interface SessionResultPlayerInput {
  playerId: number;
  name: string;
  avatarColor: string;
  gameState: unknown;
  isWinner: boolean;
}

export interface SessionTurnInput {
  playerId: number;
  darts: DartThrow[];
}

export interface ATCPlayerResult {
  name: string;
  avatarColor: string;
  targetsHit: number;
  maxTarget: number;
  isWinner: boolean;
  totalDarts: number;
  hits: number;
  turns: number;
}

export interface CricketPlayerResult {
  name: string;
  avatarColor: string;
  isWinner: boolean;
  points: number;
  segmentsClosed: number;
  totalDarts: number;
  cricketHits: number;
  totalMarks: number;
  turns: number;
}

export interface X01PlayerResult {
  name: string;
  avatarColor: string;
  isWinner: boolean;
  finalScore: number;
  dartsThrown: number;
  threeDartAvg: number;
  turns: number;
}

export interface ScorePlayerResult {
  playerId: number;
  name: string;
  avatarColor: string;
  isWinner: boolean;
  score: number;
  totalDarts: number;
  turns: number;
}

export type GameResults =
  | { type: 'atc'; players: ATCPlayerResult[] }
  | { type: 'cricket'; players: CricketPlayerResult[] }
  | { type: 'x01'; players: X01PlayerResult[] }
  | { type: 'score'; players: ScorePlayerResult[] };

function groupTurnsByPlayer(
  turns: SessionTurnInput[],
): Map<number, SessionTurnInput[]> {
  const turnsByPlayer = new Map<number, SessionTurnInput[]>();

  for (const turn of turns) {
    const playerTurns = turnsByPlayer.get(turn.playerId) ?? [];
    playerTurns.push(turn);
    turnsByPlayer.set(turn.playerId, playerTurns);
  }

  return turnsByPlayer;
}

export function buildATCResults(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
  config: AroundTheClockConfig,
): ATCPlayerResult[] {
  const turnsByPlayer = groupTurnsByPlayer(turns);
  const maxTarget = getMaxTarget(config);

  const atcResults = players.map((player) => {
    const state = player.gameState as AroundTheClockPlayerState;
    const playerTurns = turnsByPlayer.get(player.playerId) ?? [];

    let totalDarts = 0;
    let hits = 0;

    for (const turn of playerTurns) {
      totalDarts += turn.darts.length;
      hits += turn.darts.filter((d) => d.segment > 0 && d.multiplier > 0).length;
    }

    return {
      name: player.name,
      avatarColor: player.avatarColor,
      targetsHit: Math.min(state.currentTarget - 1, maxTarget),
      maxTarget,
      isWinner: player.isWinner,
      totalDarts,
      hits,
      turns: playerTurns.length,
    };
  });

  atcResults.sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    return b.targetsHit - a.targetsHit;
  });

  return atcResults;
}

export function buildCricketResults(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
): CricketPlayerResult[] {
  const turnsByPlayer = groupTurnsByPlayer(turns);

  const cricketResults = players.map((player) => {
    const state = player.gameState as CricketPlayerState;
    const playerTurns = turnsByPlayer.get(player.playerId) ?? [];

    let totalDarts = 0;
    let cricketHits = 0;
    let totalMarks = 0;

    for (const turn of playerTurns) {
      totalDarts += turn.darts.length;

      for (const dart of turn.darts) {
        const { marks } = getMarksFromDart(dart);
        if (marks > 0) {
          cricketHits++;
          totalMarks += marks;
        }
      }
    }

    const segmentsClosed = CRICKET_SEGMENTS.filter((segment) =>
      isSegmentClosed(state.marks[segment]),
    ).length;

    return {
      name: player.name,
      avatarColor: player.avatarColor,
      isWinner: player.isWinner,
      points: state.points,
      segmentsClosed,
      totalDarts,
      cricketHits,
      totalMarks,
      turns: playerTurns.length,
    };
  });

  cricketResults.sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    if (b.points !== a.points) return b.points - a.points;
    return b.segmentsClosed - a.segmentsClosed;
  });

  return cricketResults;
}

export function buildX01Results(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
  config: X01Config,
): X01PlayerResult[] {
  const turnsByPlayer = groupTurnsByPlayer(turns);

  const x01Results = players.map((player) => {
    const state = player.gameState as X01PlayerState;
    const playerTurns = turnsByPlayer.get(player.playerId) ?? [];

    let dartsThrown = 0;
    for (const turn of playerTurns) {
      dartsThrown += turn.darts.length;
    }

    const scored = config.startingScore - state.remaining;
    const threeDartAvg = dartsThrown > 0 ? (scored / dartsThrown) * 3 : 0;

    return {
      name: player.name,
      avatarColor: player.avatarColor,
      isWinner: player.isWinner,
      finalScore: state.remaining,
      dartsThrown,
      threeDartAvg,
      turns: playerTurns.length,
    };
  });

  x01Results.sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    return a.finalScore - b.finalScore;
  });

  return x01Results;
}

function buildScoreResults(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
  getScore: (state: unknown) => number,
): ScorePlayerResult[] {
  const turnsByPlayer = groupTurnsByPlayer(turns);

  const scoreResults = players.map((player) => {
    const playerTurns = turnsByPlayer.get(player.playerId) ?? [];
    const totalDarts = playerTurns.reduce((sum, t) => sum + t.darts.length, 0);
    return {
      playerId: player.playerId,
      name: player.name,
      avatarColor: player.avatarColor,
      isWinner: player.isWinner,
      score: getScore(player.gameState),
      totalDarts,
      turns: playerTurns.length,
    };
  });

  scoreResults.sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    return b.score - a.score;
  });

  return scoreResults;
}

export function buildShanghaiResults(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
): ScorePlayerResult[] {
  return buildScoreResults(
    players,
    turns,
    (s) => (s as ShanghaiPlayerState).totalScore,
  );
}

export function buildBaseballResults(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
): ScorePlayerResult[] {
  return buildScoreResults(
    players,
    turns,
    (s) => (s as BaseballPlayerState).totalRuns,
  );
}

export function buildHighScoreResults(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
): ScorePlayerResult[] {
  return buildScoreResults(
    players,
    turns,
    (s) => (s as HighScorePlayerState).totalScore,
  );
}

export function buildHalveItResults(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
): ScorePlayerResult[] {
  return buildScoreResults(
    players,
    turns,
    (s) => (s as HalveItPlayerState).score,
  );
}

export function buildBobs27Results(
  players: SessionResultPlayerInput[],
  turns: SessionTurnInput[],
): ScorePlayerResult[] {
  return buildScoreResults(
    players,
    turns,
    (s) => (s as Bobs27PlayerState).score,
  );
}
