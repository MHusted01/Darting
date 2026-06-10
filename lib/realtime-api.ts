import type { SupabaseClient } from '@supabase/supabase-js';
import { parseTurnPayload, type ChallengeSettings, type TurnBroadcastPayload } from '@/lib/realtime-game';
import type { ChallengeStatus, GameChallenge, LiveClubChallenge } from '@/types/realtime';

type Client = Pick<SupabaseClient, 'rpc' | 'from' | 'functions'>;

const CHALLENGE_SELECT = `
  id, challenger_id, challengee_id, game_slug, settings, status,
  current_turn_user_id, turn_count, last_turn, winner_user_id, created_at, updated_at,
  challenger:challenger_id(id, first_name, last_name, username),
  challengee:challengee_id(id, first_name, last_name, username)
`;

const INCOMING_WINDOW_MS = 24 * 60 * 60 * 1000;

interface RawChallengeUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}

interface RawChallengeRow {
  id: string;
  challenger_id: string;
  challengee_id: string;
  game_slug: string;
  settings: ChallengeSettings;
  status: ChallengeStatus;
  current_turn_user_id: string | null;
  turn_count: number;
  last_turn: unknown;
  winner_user_id: string | null;
  created_at: string;
  updated_at: string;
  challenger: RawChallengeUser | null;
  challengee: RawChallengeUser | null;
}

export class TurnRejectedError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Turn rejected: ${reason}`);
    this.name = 'TurnRejectedError';
    this.reason = reason;
  }
}

function displayName(user: RawChallengeUser | null): string {
  if (!user) return 'Unknown';
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.username || 'Unknown';
}

function mapChallengeRow(row: RawChallengeRow): GameChallenge {
  return {
    id: row.id,
    challengerId: row.challenger_id,
    challengeeId: row.challengee_id,
    gameSlug: row.game_slug,
    settings: row.settings ?? {},
    status: row.status,
    currentTurnUserId: row.current_turn_user_id,
    turnCount: row.turn_count,
    lastTurn: parseTurnPayload(row.last_turn),
    winnerUserId: row.winner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    challengerName: displayName(row.challenger),
    challengeeName: displayName(row.challengee),
  };
}

export interface CreateChallengeInput {
  challengerId: string;
  challengeeId: string;
  gameSlug: string;
  settings: ChallengeSettings;
}

export async function createChallenge(client: Client, data: CreateChallengeInput): Promise<string> {
  const { data: result, error } = await client
    .from('game_challenges')
    .insert({
      challenger_id: data.challengerId,
      challengee_id: data.challengeeId,
      game_slug: data.gameSlug,
      settings: data.settings,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (result as { id: string }).id;
}

export async function getChallenge(client: Client, challengeId: string): Promise<GameChallenge> {
  const { data, error } = await client
    .from('game_challenges')
    .select(CHALLENGE_SELECT)
    .eq('id', challengeId)
    .single();
  if (error) throw new Error(error.message);
  return mapChallengeRow(data as unknown as RawChallengeRow);
}

export async function listIncomingChallenges(
  client: Client,
  userId: string,
): Promise<GameChallenge[]> {
  const cutoff = new Date(Date.now() - INCOMING_WINDOW_MS).toISOString();
  const { data, error } = await client
    .from('game_challenges')
    .select(CHALLENGE_SELECT)
    .eq('challengee_id', userId)
    .eq('status', 'pending')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawChallengeRow[]).map(mapChallengeRow);
}

export async function listOutgoingChallenges(
  client: Client,
  userId: string,
): Promise<GameChallenge[]> {
  const cutoff = new Date(Date.now() - INCOMING_WINDOW_MS).toISOString();
  const { data, error } = await client
    .from('game_challenges')
    .select(CHALLENGE_SELECT)
    .eq('challenger_id', userId)
    .eq('status', 'pending')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawChallengeRow[]).map(mapChallengeRow);
}

async function conditionalStatusUpdate(
  client: Client,
  challengeId: string,
  fromStatus: ChallengeStatus,
  toStatus: ChallengeStatus,
): Promise<boolean> {
  const { data, error } = await client
    .from('game_challenges')
    .update({ status: toStatus })
    .eq('id', challengeId)
    .eq('status', fromStatus)
    .select('id');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).length > 0;
}

export function acceptChallenge(client: Client, challengeId: string): Promise<boolean> {
  return conditionalStatusUpdate(client, challengeId, 'pending', 'accepted');
}

export function declineChallenge(client: Client, challengeId: string): Promise<boolean> {
  return conditionalStatusUpdate(client, challengeId, 'pending', 'declined');
}

export function cancelChallenge(client: Client, challengeId: string): Promise<boolean> {
  return conditionalStatusUpdate(client, challengeId, 'pending', 'cancelled');
}

export async function startChallenge(client: Client, challengeId: string): Promise<void> {
  const { error } = await client.rpc('start_challenge', { p_id: challengeId });
  if (error) throw new Error(error.message);
}

export async function abandonChallenge(client: Client, challengeId: string): Promise<void> {
  const { error } = await client.rpc('abandon_challenge', { p_id: challengeId });
  if (error) throw new Error(error.message);
}

interface RawLiveChallengeRow {
  id: string;
  game_slug: string;
  settings: ChallengeSettings;
  challenger_id: string;
  challenger_name: string;
  challengee_id: string;
  challengee_name: string;
  turn_count: number;
  created_at: string;
}

export async function getLiveClubChallenges(
  client: Client,
  clubId: string,
): Promise<LiveClubChallenge[]> {
  const { data, error } = await client.rpc('get_live_club_challenges', { p_club_id: clubId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawLiveChallengeRow[]).map((row) => ({
    id: row.id,
    gameSlug: row.game_slug,
    settings: row.settings ?? {},
    challengerId: row.challenger_id,
    challengerName: row.challenger_name,
    challengeeId: row.challengee_id,
    challengeeName: row.challengee_name,
    turnCount: row.turn_count,
    createdAt: row.created_at,
  }));
}

interface FunctionsErrorContext {
  status?: number;
  json?: () => Promise<unknown>;
}

interface FunctionsError {
  name?: string;
  message?: string;
  context?: FunctionsErrorContext;
}

export async function submitTurnToServer(
  client: Client,
  payload: TurnBroadcastPayload,
): Promise<void> {
  const { error } = await client.functions.invoke('validate-turn', { body: payload });
  if (!error) return;

  const fnError = error as FunctionsError;
  if (fnError.context?.status === 409) {
    let reason = 'rejected';
    if (typeof fnError.context.json === 'function') {
      try {
        const body = (await fnError.context.json()) as { error?: string } | null;
        if (body?.error) reason = body.error;
      } catch {
        reason = 'rejected';
      }
    }
    throw new TurnRejectedError(reason);
  }

  throw new Error(fnError.message ?? 'Failed to submit turn');
}
