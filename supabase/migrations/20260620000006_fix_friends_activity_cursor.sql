-- Fix get_friends_activity: add author_id to the keyset cursor so that
-- sessions shared by multiple friends paginate correctly.
-- Old cursor: (completed_at, session_id) — not unique when multiple friends
-- share the same session, causing skipped rows at page boundaries.
-- New cursor: (completed_at, session_id, author_id) — guaranteed unique.

-- Drop the old 3-argument overload first. Without this, both signatures
-- remain visible and PostgREST sees an ambiguous overloaded function.
DROP FUNCTION IF EXISTS public.get_friends_activity(int, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.get_friends_activity(
  p_limit               int         DEFAULT 31,
  p_cursor_completed_at timestamptz DEFAULT NULL,
  p_cursor_id           uuid        DEFAULT NULL,
  p_cursor_author_id    text        DEFAULT NULL
)
RETURNS TABLE (
  session_id           uuid,
  author_id            text,
  author_first_name    text,
  author_last_name     text,
  author_username      text,
  author_avatar_url    text,
  game_slug            text,
  completed_at         timestamptz,
  is_winner            boolean,
  three_dart_avg       float8
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    gs.id           AS session_id,
    friend_id.id    AS author_id,
    u.first_name    AS author_first_name,
    u.last_name     AS author_last_name,
    u.username      AS author_username,
    u.avatar_url    AS author_avatar_url,
    gs.game_slug,
    gs.completed_at,
    gp.is_winner,
    gp.three_dart_avg
  FROM public.friendships f
  JOIN LATERAL (
    SELECT CASE
      WHEN f.requester_id = auth.jwt() ->> 'sub' THEN f.addressee_id
      ELSE f.requester_id
    END AS id
  ) friend_id ON TRUE
  JOIN public.game_players gp ON gp.user_id = friend_id.id
  JOIN public.game_sessions gs ON gs.id = gp.game_session_id AND gs.status = 'completed'
  JOIN public.users u ON u.id = friend_id.id
  WHERE (f.requester_id = auth.jwt() ->> 'sub' OR f.addressee_id = auth.jwt() ->> 'sub')
    AND f.status = 'accepted'
    AND (
      p_cursor_completed_at IS NULL
      OR (gs.completed_at, gs.id::text, friend_id.id) < (p_cursor_completed_at, p_cursor_id::text, p_cursor_author_id)
    )
  ORDER BY gs.completed_at DESC, gs.id DESC, friend_id.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_friends_activity(int, timestamptz, uuid, text) TO authenticated;
