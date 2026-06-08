import { createClient } from '@supabase/supabase-js';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

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
      requester_id: string;
      addressee_id: string;
      status: string;
    } | undefined;

    if (!record || record.status !== 'accepted') {
      return new Response('Ignored', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: accepter } = await supabase
      .from('users')
      .select('first_name, username')
      .eq('id', record.addressee_id)
      .single();

    const { data: requester } = await supabase
      .from('users')
      .select('push_token, notification_prefs')
      .eq('id', record.requester_id)
      .single();

    if (!requester?.push_token) {
      return new Response('No push token', { status: 200 });
    }

    const prefs = requester.notification_prefs as { friend_requests?: boolean } | null;
    if (prefs?.friend_requests !== undefined && prefs.friend_requests !== true) {
      return new Response('Notifications disabled', { status: 200 });
    }

    const accepterName = accepter?.first_name ?? accepter?.username ?? 'Someone';

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: requester.push_token,
        title: 'Friend Request Accepted',
        body: `${accepterName} accepted your friend request`,
        data: { type: 'friend_accepted', userId: record.addressee_id },
      }),
      signal: AbortSignal.timeout(5000),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('notify-friend-accepted error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
