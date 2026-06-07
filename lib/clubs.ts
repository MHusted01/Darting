import type { SupabaseClient } from '@supabase/supabase-js';
import type { Club, ClubMember, ClubLeaderboardRow, ClubRole } from '@/types/social';

// ─── Row types ────────────────────────────────────────────────────────────────

type ClubRow = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type MembershipWithClub = {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
  club: ClubRow;
};

type MemberRow = {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
  user: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null };
};

type LeaderboardRow = {
  club_id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  games_played: number;
  avg_three_dart_avg: number | null;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function mapClubRow(row: ClubRow, role: ClubRole): Club {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    createdBy:   row.created_by,
    role,
  };
}

export function mapMemberRow(row: MemberRow): ClubMember {
  return {
    membershipId: row.id,
    id:           row.user.id,
    firstName:    row.user.first_name,
    lastName:     row.user.last_name,
    avatarUrl:    row.user.avatar_url,
    username:     row.user.username,
    role:         row.role,
    joinedAt:     row.joined_at,
  };
}

export function mapLeaderboardRow(row: LeaderboardRow): ClubLeaderboardRow {
  return {
    userId:           row.user_id,
    firstName:        row.first_name,
    lastName:         row.last_name,
    avatarUrl:        row.avatar_url,
    gamesPlayed:      row.games_played,
    avgThreeDartAvg:  row.avg_three_dart_avg,
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function createClub(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  description?: string,
): Promise<Club> {
  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .insert({ name, description: description ?? null, created_by: userId })
    .select('id, name, description, created_by, created_at, updated_at')
    .single();

  if (clubError) throw new Error(clubError.message);

  // Non-atomic: club created first, then admin membership.
  // On membership failure, attempt best-effort cleanup of the orphaned club row
  // so it does not become permanently unmanageable (no admin = no delete/update via RLS).
  const { error: memberError } = await supabase
    .from('club_memberships')
    .insert({ club_id: club.id, user_id: userId, role: 'admin' });

  if (memberError) {
    await supabase.from('clubs').delete().eq('id', club.id);
    throw new Error(memberError.message);
  }

  return mapClubRow(club as ClubRow, 'admin');
}

export async function searchClubs(
  supabase: SupabaseClient,
  query: string,
): Promise<Club[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, description, created_by, created_at, updated_at')
    .ilike('name', `%${query}%`);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: ClubRow) => mapClubRow(row, 'member'));
}

export async function getMyClubs(
  supabase: SupabaseClient,
  userId: string,
): Promise<Club[]> {
  const { data, error } = await supabase
    .from('club_memberships')
    .select('id, club_id, user_id, role, joined_at, club:clubs(id, name, description, created_by, created_at, updated_at)')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MembershipWithClub[]).map((row) => mapClubRow(row.club, row.role));
}

export async function joinClub(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<{ alreadyMember: boolean }> {
  const { error } = await supabase
    .from('club_memberships')
    .insert({ club_id: clubId, user_id: userId, role: 'member' });

  if (error) {
    if (error.code === '23505') return { alreadyMember: true };
    throw new Error(error.message);
  }
  return { alreadyMember: false };
}

export async function leaveClub(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('club_memberships')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function getClubMembers(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ClubMember[]> {
  const { data, error } = await supabase
    .from('club_memberships')
    .select('id, club_id, user_id, role, joined_at, user:users(id, first_name, last_name, avatar_url, username)')
    .eq('club_id', clubId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MemberRow[]).map((row) => mapMemberRow(row));
}

export async function getClubLeaderboard(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ClubLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_club_leaderboard', { p_club_id: clubId });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as LeaderboardRow[]).map((row) => mapLeaderboardRow(row));
}

export async function inviteMember(
  supabase: SupabaseClient,
  clubId: string,
  invitedBy: string,
  inviteeId: string,
): Promise<void> {
  const { error } = await supabase
    .from('club_invites')
    .insert({ club_id: clubId, invited_by: invitedBy, invitee_id: inviteeId });

  if (error) throw new Error(error.message);
}
