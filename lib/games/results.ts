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

export type GameResults =
  | { type: 'atc'; players: ATCPlayerResult[] }
  | { type: 'cricket'; players: CricketPlayerResult[] };

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
