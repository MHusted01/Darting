import type { UserProfile } from '@/types/social';

export type TournamentFormat = 'league' | 'cup' | 'weekly' | 'round_robin';
export type TournamentStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'bye';
export type ParticipantStatus = 'active' | 'eliminated';
export type RoundStatus = 'pending' | 'active' | 'completed';
export type DivisionClubStatus = 'pending' | 'accepted';

export interface TournamentSettings {
  legsPerMatch: number;
  doubleOut: boolean;
  maxParticipants?: number;
}

export interface Tournament {
  id: string;
  clubId: string | null;
  divisionId: string | null;
  createdBy: string;
  name: string;
  format: TournamentFormat;
  gameSlug: string;
  status: TournamentStatus;
  startDate: string | null;
  endDate: string | null;
  settings: TournamentSettings;
  participantCount: number;
  createdAt: string;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  user: UserProfile;
  clubId: string | null;
  seeding: number | null;
  status: ParticipantStatus;
}

export interface TournamentMatch {
  id: string;
  roundId: string;
  participant1: TournamentParticipant | null;
  participant2: TournamentParticipant | null;
  winner: TournamentParticipant | null;
  gameSessionId: string | null;
  status: MatchStatus;
  createdAt: string;
}

export interface TournamentRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
  status: RoundStatus;
  matches: TournamentMatch[];
}

export interface TournamentDetail extends Tournament {
  participants: TournamentParticipant[];
  rounds: TournamentRound[];
}

export interface LeagueStandingRow {
  participant: TournamentParticipant;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  legDiff: number;
}

export interface TournamentListPage {
  items: Tournament[];
  nextCursor: string | null;
}

export interface Division {
  id: string;
  name: string;
  adminUserId: string;
  createdAt: string;
}

export interface DivisionClub {
  divisionId: string;
  clubId: string;
  status: DivisionClubStatus;
}

export interface MatchSpec {
  participant1Id: string | null;
  participant2Id: string | null;
  status: MatchStatus;
}
