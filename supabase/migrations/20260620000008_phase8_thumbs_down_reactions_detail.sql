-- Add thumbs_down to reaction type enum on both tables.
ALTER TABLE public.club_post_reactions
  DROP CONSTRAINT IF EXISTS club_post_reactions_type_check,
  ADD CONSTRAINT club_post_reactions_type_check
    CHECK (type IN ('thumbs_up', 'bullseye', 'fire', 'thumbs_down'));

ALTER TABLE public.club_comment_reactions
  DROP CONSTRAINT IF EXISTS club_comment_reactions_type_check,
  ADD CONSTRAINT club_comment_reactions_type_check
    CHECK (type IN ('thumbs_up', 'bullseye', 'fire', 'thumbs_down'));

-- ─── Recreate get_club_feed with thumbs_down_count ────────────────────────────
DROP FUNCTION public.get_club_feed(uuid, timestamptz, uuid, int);

CREATE FUNCTION public.get_club_feed(
  p_club_id           uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL,
  p_limit             int         DEFAULT 21
)
RETURNS TABLE (
  id                  uuid,
  club_id             uuid,
  author_id           text,
  body                text,
  game_session_id     uuid,
  created_at          timestamptz,
  author_first_name   text,
  author_last_name    text,
  author_username     text,
  author_avatar_url   text,
  thumbs_up_count     int,
  bullseye_count      int,
  fire_count          int,
  thumbs_down_count   int,
  my_reactions        text[],
  comment_count       int,
  game_slug           text,
  game_three_dart_avg float8
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    cp.id, cp.club_id, cp.author_id, cp.body, cp.game_session_id, cp.created_at,
    u.first_name AS author_first_name, u.last_name AS author_last_name,
    u.username AS author_username, u.avatar_url AS author_avatar_url,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'thumbs_up')::int    AS thumbs_up_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'bullseye')::int     AS bullseye_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'fire')::int         AS fire_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'thumbs_down')::int  AS thumbs_down_count,
    COALESCE(
      (SELECT array_agg(r2.type) FROM public.club_post_reactions r2
       WHERE r2.post_id = cp.id AND r2.user_id = auth.jwt() ->> 'sub'),
      '{}'::text[]
    ) AS my_reactions,
    COUNT(DISTINCT cc.id)::int AS comment_count,
    CASE WHEN gp.user_id IS NOT NULL THEN gs.game_slug ELSE NULL END AS game_slug,
    gp.three_dart_avg AS game_three_dart_avg
  FROM public.club_posts cp
  JOIN public.users u ON u.id = cp.author_id
  LEFT JOIN public.club_post_reactions r ON r.post_id = cp.id
  LEFT JOIN public.club_post_comments cc ON cc.post_id = cp.id
  LEFT JOIN public.game_sessions gs ON gs.id = cp.game_session_id
  LEFT JOIN public.game_players gp ON gp.game_session_id = cp.game_session_id AND gp.user_id = cp.author_id
  WHERE cp.club_id = p_club_id
    AND EXISTS (SELECT 1 FROM public.club_memberships WHERE club_id = p_club_id AND user_id = auth.jwt() ->> 'sub')
    AND (p_cursor_created_at IS NULL OR (cp.created_at, cp.id) < (p_cursor_created_at, p_cursor_id))
  GROUP BY cp.id, cp.club_id, cp.author_id, cp.body, cp.game_session_id, cp.created_at,
           u.first_name, u.last_name, u.username, u.avatar_url,
           gs.game_slug, gp.user_id, gp.three_dart_avg
  ORDER BY cp.created_at DESC, cp.id DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_club_feed(uuid, timestamptz, uuid, int) TO authenticated;

-- ─── Recreate get_post_comments with thumbs_down_count ───────────────────────
DROP FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int);

CREATE FUNCTION public.get_post_comments(
  p_post_id           uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL,
  p_limit             int         DEFAULT 50
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
      (SELECT array_agg(r2.type) FROM public.club_comment_reactions r2
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

-- ─── Recreate get_latest_post_comments with thumbs_down_count ────────────────
DROP FUNCTION public.get_latest_post_comments(uuid, int);

CREATE FUNCTION public.get_latest_post_comments(
  p_post_id uuid,
  p_limit   int DEFAULT 2
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
      (SELECT array_agg(r2.type) FROM public.club_comment_reactions r2
       WHERE r2.comment_id = c.id AND r2.user_id = auth.jwt() ->> 'sub'),
      '{}'::text[]
    ) AS my_reactions
  FROM public.club_post_comments c
  JOIN public.users u ON u.id = c.author_id
  JOIN public.club_posts cp ON cp.id = c.post_id
  LEFT JOIN public.club_comment_reactions r ON r.comment_id = c.id
  WHERE c.post_id = p_post_id
    AND c.parent_comment_id IS NULL
    AND EXISTS (SELECT 1 FROM public.club_memberships WHERE club_id = cp.club_id AND user_id = auth.jwt() ->> 'sub')
  GROUP BY c.id, c.post_id, c.parent_comment_id, c.author_id, c.body, c.created_at,
           u.first_name, u.last_name, u.username, u.avatar_url
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_latest_post_comments(uuid, int) TO authenticated;

-- ─── get_post_reactions — who reacted with what on a post ────────────────────
CREATE FUNCTION public.get_post_reactions(p_post_id uuid)
RETURNS TABLE (
  user_id    text,
  first_name text,
  last_name  text,
  username   text,
  type       text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT r.user_id, u.first_name, u.last_name, u.username, r.type
  FROM public.club_post_reactions r
  JOIN public.users u ON u.id = r.user_id
  WHERE r.post_id = p_post_id
    AND EXISTS (
      SELECT 1 FROM public.club_memberships cm
      JOIN public.club_posts cp ON cp.id = p_post_id
      WHERE cm.club_id = cp.club_id AND cm.user_id = auth.jwt() ->> 'sub'
    )
  ORDER BY r.type, u.first_name NULLS LAST, u.username NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_post_reactions(uuid) TO authenticated;

-- ─── get_comment_reactions — who reacted with what on a comment ───────────────
CREATE FUNCTION public.get_comment_reactions(p_comment_id uuid)
RETURNS TABLE (
  user_id    text,
  first_name text,
  last_name  text,
  username   text,
  type       text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT r.user_id, u.first_name, u.last_name, u.username, r.type
  FROM public.club_comment_reactions r
  JOIN public.users u ON u.id = r.user_id
  WHERE r.comment_id = p_comment_id
    AND EXISTS (
      SELECT 1 FROM public.club_memberships cm
      JOIN public.club_post_comments c ON c.id = p_comment_id
      JOIN public.club_posts cp ON cp.id = c.post_id
      WHERE cm.club_id = cp.club_id AND cm.user_id = auth.jwt() ->> 'sub'
    )
  ORDER BY r.type, u.first_name NULLS LAST, u.username NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_comment_reactions(uuid) TO authenticated;
