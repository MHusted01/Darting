import { createClient } from '@supabase/supabase-js';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

const GAME_NAMES: Record<string, string> = {
  x01: '501 / 301',
  cricket: 'Cricket',
  'around-the-clock': 'Around the Clock',
  shanghai: 'Shanghai',
  baseball: 'Baseball',
  'halve-it': 'Halve-It',
  'high-score': 'High Score',
  'bobs-27': "Bob's 27",
  'bermuda-triangle': 'Bermuda Triangle',
};

Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET') ?? '';
  const incomingSecret = req.headers.get('x-webhook-secret') ?? '';
  if (!webhookSecret || incomingSecret !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const payload = await req.json();

    const record = payload.record as {
      id: string;
      challenger_id: string;
      challengee_id: string;
      game_slug: string;
      status: string;
    } | undefined;

    if (!record || record.status !== 'pending') {
      return new Response('Ignored', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: challenger } = await supabase
      .from('users')
      .select('first_name, username')
      .eq('id', record.challenger_id)
      .single();

    const { data: recipient } = await supabase
      .from('users')
      .select('push_token, notification_prefs')
      .eq('id', record.challengee_id)
      .single();

    if (!recipient?.push_token) {
      return new Response('No push token', { status: 200 });
    }

    const prefs = recipient.notification_prefs as { match_challenges?: boolean } | null;
    if (prefs?.match_challenges !== undefined && prefs.match_challenges !== true) {
      return new Response('Notifications disabled', { status: 200 });
    }

    const challengerName = challenger?.first_name ?? challenger?.username ?? 'Someone';
    const gameName = GAME_NAMES[record.game_slug] ?? record.game_slug;

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipient.push_token,
        title: 'Game Challenge',
        body: `${challengerName} challenged you to ${gameName}`,
        data: { type: 'game_challenge', challengeId: record.id },
      }),
      signal: AbortSignal.timeout(5000),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('notify-game-challenge error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
