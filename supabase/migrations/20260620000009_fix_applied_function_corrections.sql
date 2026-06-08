-- Corrects two function definitions that were edited in already-applied
-- migration files and therefore never took effect on the remote DB.

-- 1. get_friends_activity: ORDER BY was gs.id DESC (UUID ordering) but the
--    keyset cursor comparison casts gs.id::text, so ordering must match.
--    Recreate with gs.id::text DESC for consistency.

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
  ORDER BY gs.completed_at DESC, gs.id::text DESC, friend_id.id DESC
  LIMIT p_limit;
$$;

-- 2. get_post_comments: default p_limit was inadvertently changed from 31 to
--    50. Restore to 31 so implicit calls (if any) behave as originally intended.
--    All current call sites pass an explicit value, so this is low-impact but
--    keeps the interface contract consistent.

DROP FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int);

CREATE FUNCTION public.get_post_comments(
  p_post_id           uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL,
  p_limit             int         DEFAULT 31
)
RETURNS TABLE (
  id                   uuid,
  post_id              uuid,
  parent_comment_id    uuid,
  author_id            text,
  body                 text,
  created_at           timestamptz,
  author_first_name    text,
  author_last_name     text,
  author_username      text,
  author_avatar_url    text,
  thumbs_up_count      int,
  bullseye_count       int,
  fire_count           int,
  thumbs_down_count    int,
  my_reactions         text[]
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    c.id, c.post_id, c.parent_comment_id, c.author_id, c.body, c.created_at,
    u.first_name AS author_first_name, u.last_name AS author_last_name,
    u.username AS author_username, u.avatar_url AS author_avatar_url,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'thumbs_up')::int    AS thumbs_up_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'bullseye')::int     AS bullseye_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'fire')::int         AS fire_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'thumbs_down')::int  AS thumbs_down_count,
    COALESCE(
      (SELECT array_agg(r2.type)
       FROM public.club_comment_reactions r2
       WHERE r2.comment_id = c.id AND r2.user_id = auth.jwt() ->> 'sub'),
      '{}'::text[]
    ) AS my_reactions
  FROM public.club_post_comments c
  JOIN public.users u ON u.id = c.author_id
  JOIN public.club_posts cp ON cp.id = c.post_id
  LEFT JOIN public.club_comment_reactions r ON r.comment_id = c.id
  WHERE c.post_id = p_post_id
    AND EXISTS (SELECT 1 FROM public.club_memberships WHERE club_id = cp.club_id AND user_id = auth.jwt() ->> 'sub')
    AND (p_cursor_created_at IS NULL OR (c.created_at, c.id) > (p_cursor_created_at, p_cursor_id))
  GROUP BY c.id, c.post_id, c.parent_comment_id, c.author_id, c.body, c.created_at,
           u.first_name, u.last_name, u.username, u.avatar_url
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int) TO authenticated;
