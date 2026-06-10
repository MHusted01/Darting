import type { ChallengeSettings, TurnBroadcastPayload } from '@/lib/realtime-game';

export type ChallengeStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'complete'
  | 'cancelled'
  | 'abandoned';

export interface GameChallenge {
  id: string;
  challengerId: string;
  challengeeId: string;
  gameSlug: string;
  settings: ChallengeSettings;
  status: ChallengeStatus;
  currentTurnUserId: string | null;
  turnCount: number;
  lastTurn: TurnBroadcastPayload | null;
  winnerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  challengerName: string;
  challengeeName: string;
}

export interface LiveClubChallenge {
  id: string;
  gameSlug: string;
  settings: ChallengeSettings;
  challengerId: string;
  challengerName: string;
  challengeeId: string;
  challengeeName: string;
  turnCount: number;
  createdAt: string;
}
