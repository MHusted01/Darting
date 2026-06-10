import { createClient } from '@supabase/supabase-js';

interface DartThrow {
  segment: number;
  multiplier: number;
}

interface TurnPayload {
  challengeId: string;
  turnSeq: number;
  userId: string;
  darts: DartThrow[];
  isComplete: boolean;
  winnerUserId: string | null;
  scores: Record<string, number>;
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

function parsePayload(value: unknown): TurnPayload | null {
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
    darts: raw.darts as DartThrow[],
    isComplete: raw.isComplete,
    winnerUserId: raw.winnerUserId as string | null,
    scores: scores as Record<string, number>,
  };
}

const REJECTION_STATUSES = new Set([
  'not_your_turn',
  'stale_seq',
  'not_in_progress',
  'not_participant',
  'not_found',
  'invalid_winner',
  'user_mismatch',
  'invalid_turn',
]);

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const payload = parsePayload(await req.json());
    if (!payload) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: result, error } = await callerClient.rpc('advance_challenge_turn', {
      p_id: payload.challengeId,
      p_turn_seq: payload.turnSeq,
      p_is_complete: payload.isComplete,
      p_winner_user_id: payload.winnerUserId,
      p_user_id: payload.userId,
      p_darts: payload.darts,
      p_scores: payload.scores,
    });

    if (error) {
      const status = error.code === 'PGRST301' || error.message?.includes('JWT') ? 401 : 500;
      console.error('advance_challenge_turn error:', error);
      return new Response(JSON.stringify({ error: 'turn_update_failed' }), { status });
    }

    if (result !== 'ok') {
      const status = REJECTION_STATUSES.has(result as string) ? 409 : 500;
      return new Response(JSON.stringify({ error: result }), { status });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('validate-turn error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
