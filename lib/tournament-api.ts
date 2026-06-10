import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Tournament,
  TournamentDetail,
  TournamentListPage,
  TournamentParticipant,
  TournamentRound,
  LeagueStandingRow,
  TournamentStatus,
  TournamentFormat,
  TournamentSettings,
  RoundStatus,
  MatchStatus,
  ParticipantStatus,
} from '@/types/tournament';
import type { UserProfile } from '@/types/social';
import { mapTournamentRow, generateKnockoutBracket, generateRoundRobinPairings, type RawTournamentRow } from '@/lib/tournament';

type Client = Pick<SupabaseClient, 'rpc' | 'from'>;

export interface CreateTournamentInput {
  clubId: string | null;
  divisionId: string | null;
  createdBy: string;
  name: string;
  format: TournamentFormat;
  gameSlug: string;
  settings: TournamentSettings;
  startDate?: string;
  endDate?: string;
}

export async function createTournament(client: Client, data: CreateTournamentInput): Promise<string> {
  const { data: result, error } = await client
    .from('tournaments')
    .insert({
      club_id: data.clubId,
      division_id: data.divisionId,
      created_by: data.createdBy,
      name: data.name,
      format: data.format,
      game_slug: data.gameSlug,
      settings: data.settings,
      start_date: data.startDate ?? null,
      end_date: data.endDate ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (result as { id: string }).id;
}

export async function updateTournamentStatus(
  client: Client,
  tournamentId: string,
  status: TournamentStatus,
): Promise<void> {
  const { error } = await client.from('tournaments').update({ status }).eq('id', tournamentId);
  if (error) throw new Error(error.message);
}

export async function startTournament(
  client: Client,
  tournamentId: string,
  format: TournamentFormat,
  participants: TournamentParticipant[],
): Promise<void> {
  const { data: existingRound, error: roundCheckError } = await client
    .from('tournament_rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round_number', 1)
    .maybeSingle();
  if (roundCheckError) throw new Error(roundCheckError.message);

  const specs =
    format === 'cup'
      ? generateKnockoutBracket(participants)
      : generateRoundRobinPairings(participants);

  if (specs.length > 0) {
    if (!existingRound) {
      const { data: round, error: roundError } = await client
        .from('tournament_rounds')
        .insert({ tournament_id: tournamentId, round_number: 1, status: 'active' })
        .select('id')
        .single();
      if (roundError) throw new Error(roundError.message);

      const { error: matchError } = await client.from('tournament_matches').insert(
        specs.map((s, i) => ({
          round_id: (round as { id: string }).id,
          participant1_id: s.participant1Id,
          participant2_id: s.participant2Id,
          status: s.status,
          bracket_slot: i + 1,
        })),
      );
      if (matchError) throw new Error(matchError.message);
    } else {
      const { count, error: countError } = await client
        .from('tournament_matches')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', existingRound.id);
      if (countError) throw new Error(countError.message);

      if ((count ?? 0) === 0) {
        const { error: matchError } = await client.from('tournament_matches').insert(
          specs.map((s, i) => ({
            round_id: existingRound.id,
            participant1_id: s.participant1Id,
            participant2_id: s.participant2Id,
            status: s.status,
            bracket_slot: i + 1,
          })),
        );
        if (matchError) throw new Error(matchError.message);
      }
    }
  }

  await updateTournamentStatus(client, tournamentId, 'active');
}

export async function registerParticipant(
  client: Client,
  tournamentId: string,
  userId: string,
  clubId?: string,
): Promise<void> {
  const { error } = await client.from('tournament_participants').insert({
    tournament_id: tournamentId,
    user_id: userId,
    club_id: clubId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function unregisterParticipant(
  client: Client,
  tournamentId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('tournament_participants')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

function encodeCursor(row: RawTournamentRow): string {
  return JSON.stringify({ createdAt: row.created_at, id: row.id });
}

export async function getClubTournaments(
  client: Client,
  clubId: string,
  cursor: string | null,
  limit: number,
): Promise<TournamentListPage> {
  const { data, error } = await client.rpc('get_club_tournaments', {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: limit + 1,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RawTournamentRow[];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(mapTournamentRow);
  const nextCursor = hasMore ? encodeCursor(rows[limit - 1]) : null;
  return { items, nextCursor };
}

export async function getMyActiveTournaments(client: Client): Promise<Tournament[]> {
  const { data, error } = await client.rpc('get_my_active_tournaments');
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawTournamentRow[]).map(mapTournamentRow);
}

interface RawParticipantRow {
  id: string;
  tournament_id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
  club_id: string | null;
  seeding: number | null;
  status: string;
}

interface RawMatchRow {
  id: string;
  round_id: string;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  game_session_id: string | null;
  status: string;
  created_at: string;
}

interface RawRoundRow {
  id: string;
  tournament_id: string;
  round_number: number;
  status: string;
  matches: RawMatchRow[] | null;
}

interface RawDetailResult {
  tournament: RawTournamentRow;
  participants: RawParticipantRow[] | null;
  rounds: RawRoundRow[] | null;
}

function mapParticipantRow(raw: RawParticipantRow): TournamentParticipant {
  const user: UserProfile = {
    id: raw.user_id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    avatarUrl: raw.avatar_url,
    username: raw.username,
  };
  return {
    id: raw.id,
    tournamentId: raw.tournament_id,
    user,
    clubId: raw.club_id,
    seeding: raw.seeding,
    status: raw.status as ParticipantStatus,
  };
}

export async function getTournamentDetail(client: Client, tournamentId: string): Promise<TournamentDetail> {
  const { data, error } = await client.rpc('get_tournament_detail', { p_tournament_id: tournamentId });
  if (error) throw new Error(error.message);

  const raw = data as RawDetailResult;
  const participantMap = new Map<string, TournamentParticipant>(
    (raw.participants ?? []).map(p => [p.id, mapParticipantRow(p)]),
  );

  const rounds: TournamentRound[] = (raw.rounds ?? []).map(r => ({
    id: r.id,
    tournamentId: r.tournament_id,
    roundNumber: r.round_number,
    status: r.status as RoundStatus,
    matches: (r.matches ?? []).map(m => ({
      id: m.id,
      roundId: m.round_id,
      participant1: m.participant1_id ? (participantMap.get(m.participant1_id) ?? null) : null,
      participant2: m.participant2_id ? (participantMap.get(m.participant2_id) ?? null) : null,
      winner: m.winner_id ? (participantMap.get(m.winner_id) ?? null) : null,
      gameSessionId: m.game_session_id,
      status: m.status as MatchStatus,
      createdAt: m.created_at,
    })),
  }));

  const participants = Array.from(participantMap.values());
  const base = mapTournamentRow(raw.tournament);

  return { ...base, participantCount: participants.length, participants, rounds };
}

export async function completeTournamentMatch(
  client: Client,
  matchId: string,
  winnerId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await client.rpc('complete_tournament_match', {
    p_match_id: matchId,
    p_winner_id: winnerId,
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
}

export async function createDivision(client: Client, name: string, adminUserId: string): Promise<string> {
  const { data, error } = await client
    .from('divisions')
    .insert({ name, admin_user_id: adminUserId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function inviteClubToDivision(
  client: Client,
  divisionId: string,
  clubId: string,
): Promise<void> {
  const { error } = await client.from('division_clubs').insert({
    division_id: divisionId,
    club_id: clubId,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function acceptDivisionInvite(
  client: Client,
  divisionId: string,
  clubId: string,
): Promise<void> {
  const { error } = await client
    .from('division_clubs')
    .update({ status: 'accepted' })
    .eq('division_id', divisionId)
    .eq('club_id', clubId);
  if (error) throw new Error(error.message);
}

export async function searchClubsForDivision(
  client: Client,
  query: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await client
    .from('clubs')
    .select('id, name')
    .ilike('name', `%${query}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}
