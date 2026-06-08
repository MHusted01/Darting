import { createClient } from '@supabase/supabase-js';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

function parseMentions(body: string): string[] {
  const re = /(?:^|[^\w@])@([a-zA-Z0-9_]{2,})/g;
  const seen = new Set<string>();
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const handle = match[1].toLowerCase();
    if (!seen.has(handle)) {
      seen.add(handle);
      results.push(handle);
    }
  }
  return results;
}

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
      club_id?: string;
      post_id?: string;
      author_id: string;
      body: string;
    } | undefined;

    if (!record?.body) {
      return new Response('Ignored', { status: 200 });
    }

    const handles = parseMentions(record.body);
    if (handles.length === 0) {
      return new Response('No mentions', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const clubId: string | null = record.club_id ?? (
      record.post_id
        ? (await supabase.from('club_posts').select('club_id').eq('id', record.post_id).single()).data?.club_id ?? null
        : null
    );

    if (!clubId) {
      return new Response('Club not found', { status: 200 });
    }

    const { data: author } = await supabase
      .from('users')
      .select('first_name, username')
      .eq('id', record.author_id)
      .single();

    const { data: clubRow } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', clubId)
      .single();

    const authorName = author?.first_name ?? author?.username ?? 'Someone';
    const clubName = clubRow?.name ?? 'a club';

    const { data: mentionedUsers } = await supabase
      .from('users')
      .select('id, username, push_token, notification_prefs')
      .in('username', handles)
      .neq('id', record.author_id);

    if (!mentionedUsers || mentionedUsers.length === 0) {
      return new Response('No valid mention targets', { status: 200 });
    }

    const { data: members } = await supabase
      .from('club_memberships')
      .select('user_id')
      .eq('club_id', clubId)
      .in('user_id', mentionedUsers.map((u) => u.id));

    const memberIds = new Set((members ?? []).map((m) => m.user_id));

    const notifications = mentionedUsers
      .filter((u) => memberIds.has(u.id) && u.push_token)
      .filter((u) => {
        const prefs = u.notification_prefs as { mentions?: boolean } | null;
        return prefs?.mentions !== false;
      })
      .map((u) => ({
        to: u.push_token,
        title: 'You were mentioned',
        body: `${authorName} mentioned you in ${clubName}`,
        data: { type: 'mention', clubId, authorId: record.author_id },
      }));

    if (notifications.length === 0) {
      return new Response('No eligible recipients', { status: 200 });
    }

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifications),
      signal: AbortSignal.timeout(5000),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('notify-mention error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
