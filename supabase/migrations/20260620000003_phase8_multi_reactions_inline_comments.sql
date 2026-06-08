-- Allow all 3 reactions independently per user per post.
-- Old constraint: unique(post_id, user_id)   — one reaction total per user
-- New constraint: unique(post_id, user_id, type) — one of each emoji per user

ALTER TABLE public.club_post_reactions
  DROP CONSTRAINT unique_reaction_per_user,
  ADD CONSTRAINT unique_reaction_type_per_user UNIQUE (post_id, user_id, type);

-- UPDATE policy no longer makes sense (switching emoji is now delete + insert)
DROP POLICY "Users can update their own reaction" ON public.club_post_reactions;

-- Recreate get_club_feed: my_reaction text → my_reactions text[]
-- Must DROP first because the RETURNS TABLE shape changes.
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
  my_reactions        text[],
  comment_count       int,
  game_slug           text,
  game_three_dart_avg float8
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    cp.id,
    cp.club_id,
    cp.author_id,
    cp.body,
    cp.game_session_id,
    cp.created_at,
    u.first_name                                                   AS author_first_name,
    u.last_name                                                    AS author_last_name,
    u.username                                                     AS author_username,
    u.avatar_url                                                   AS author_avatar_url,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'thumbs_up')::int  AS thumbs_up_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'bullseye')::int   AS bullseye_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'fire')::int       AS fire_count,
    COALESCE(
      (SELECT array_agg(r2.type)
       FROM public.club_post_reactions r2
       WHERE r2.post_id = cp.id AND r2.user_id = auth.jwt() ->> 'sub'),
      '{}'::text[]
    )                                                              AS my_reactions,
    COUNT(DISTINCT cc.id)::int                                     AS comment_count,
    CASE WHEN gp.user_id IS NOT NULL THEN gs.game_slug ELSE NULL END AS game_slug,
    gp.three_dart_avg                                              AS game_three_dart_avg
  FROM public.club_posts cp
  JOIN public.users u ON u.id = cp.author_id
  LEFT JOIN public.club_post_reactions r ON r.post_id = cp.id
  LEFT JOIN public.club_post_comments cc ON cc.post_id = cp.id
  LEFT JOIN public.game_sessions gs ON gs.id = cp.game_session_id
  LEFT JOIN public.game_players gp
    ON gp.game_session_id = cp.game_session_id
    AND gp.user_id = cp.author_id
  WHERE cp.club_id = p_club_id
    AND EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = p_club_id AND user_id = auth.jwt() ->> 'sub'
    )
    AND (
      p_cursor_created_at IS NULL
      OR (cp.created_at, cp.id) < (p_cursor_created_at, p_cursor_id)
    )
  GROUP BY cp.id, cp.club_id, cp.author_id, cp.body, cp.game_session_id, cp.created_at,
           u.first_name, u.last_name, u.username, u.avatar_url,
           gs.game_slug, gp.user_id, gp.three_dart_avg
  ORDER BY cp.created_at DESC, cp.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_feed(uuid, timestamptz, uuid, int) TO authenticated;
