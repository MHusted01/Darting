-- Phase 8: Friend social RPCs — can_view_player helper + recent games + friends activity + mutual clubs

-- ─── can_view_player helper ───────────────────────────────────────────────────
-- Returns true if the caller can view the target player's game data:
-- they must be the same person, an accepted friend, or share a club.
-- Used by get_player_recent_games; also refactors the predicate from
-- get_player_public_stats (which is replaced below via CREATE OR REPLACE).
CREATE FUNCTION public.can_view_player(viewer text, target text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    viewer = target
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = viewer AND addressee_id = target)
          OR (addressee_id = viewer AND requester_id = target)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.club_memberships cm1
      JOIN public.club_memberships cm2 ON cm1.club_id = cm2.club_id
      WHERE cm1.user_id = viewer AND cm2.user_id = target
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_player(text, text) TO authenticated;

-- ─── get_player_public_stats (refactored to use can_view_player) ──────────────
CREATE OR REPLACE FUNCTION public.get_player_public_stats(p_user_id text)
RETURNS TABLE (
  user_id            text,
  first_name         text,
  last_name          text,
  username           text,
  games_played       int,
  avg_three_dart_avg float8,
  win_rate           float8,
  per_game_kpis      jsonb
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.username,
    agg.games_played,
    agg.avg_three_dart_avg,
    agg.win_rate,
    COALESCE(slug_kpis.per_game_kpis, '{}'::jsonb) AS per_game_kpis
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT gs.id)::int                                            AS games_played,
      AVG(gp.three_dart_avg) FILTER (WHERE gp.three_dart_avg IS NOT NULL)  AS avg_three_dart_avg,
      AVG(CASE WHEN gp.is_winner THEN 1.0 ELSE 0.0 END)                    AS win_rate
    FROM public.game_players gp
    JOIN public.game_sessions gs
      ON gs.id = gp.game_session_id
      AND gs.status = 'completed'
      AND gs.context != 'practice'
    WHERE gp.user_id = u.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      jsonb_object_agg(slug_row.game_slug, slug_row.slug_avg)
        FILTER (WHERE slug_row.slug_avg IS NOT NULL)                        AS per_game_kpis
    FROM (
      SELECT
        gs2.game_slug,
        AVG(gp2.three_dart_avg) FILTER (WHERE gp2.three_dart_avg IS NOT NULL) AS slug_avg
      FROM public.game_players gp2
      JOIN public.game_sessions gs2
        ON gs2.id = gp2.game_session_id
        AND gs2.status = 'completed'
        AND gs2.context != 'practice'
      WHERE gp2.user_id = u.id
      GROUP BY gs2.game_slug
    ) slug_row
  ) slug_kpis ON TRUE
  WHERE u.id = p_user_id
    AND public.can_view_player(auth.jwt() ->> 'sub', p_user_id);
$$;

-- ─── get_player_recent_games RPC ──────────────────────────────────────────────
CREATE FUNCTION public.get_player_recent_games(
  p_user_id text,
  p_limit   int DEFAULT 10
)
RETURNS TABLE (
  id             uuid,
  game_slug      text,
  completed_at   timestamptz,
  is_winner      boolean,
  three_dart_avg float8
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    gs.id,
    gs.game_slug,
    gs.completed_at,
    gp.is_winner,
    gp.three_dart_avg
  FROM public.game_players gp
  JOIN public.game_sessions gs ON gs.id = gp.game_session_id AND gs.status = 'completed'
  WHERE gp.user_id = p_user_id
    AND public.can_view_player(auth.jwt() ->> 'sub', p_user_id)
  ORDER BY gs.completed_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_recent_games(text, int) TO authenticated;

-- ─── get_friends_activity RPC ─────────────────────────────────────────────────
-- Returns accepted friends' recent completed games, keyset-paginated.
CREATE FUNCTION public.get_friends_activity(
  p_limit              int         DEFAULT 31,
  p_cursor_completed_at timestamptz DEFAULT NULL,
  p_cursor_id          uuid        DEFAULT NULL
)
RETURNS TABLE (
  session_id           uuid,
  author_id            text,
  author_first_name    text,
  author_last_name     text,
  author_username      text,
  author_avatar_url text,
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
    u.avatar_url AS author_avatar_url,
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
      OR (gs.completed_at, gs.id) < (p_cursor_completed_at, p_cursor_id)
    )
  ORDER BY gs.completed_at DESC, gs.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_friends_activity(int, timestamptz, uuid) TO authenticated;

-- ─── get_mutual_clubs RPC ─────────────────────────────────────────────────────
CREATE FUNCTION public.get_mutual_clubs(p_user_id text)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT c.id, c.name
  FROM public.clubs c
  JOIN public.club_memberships cm1 ON cm1.club_id = c.id AND cm1.user_id = auth.jwt() ->> 'sub'
  JOIN public.club_memberships cm2 ON cm2.club_id = c.id AND cm2.user_id = p_user_id
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_mutual_clubs(text) TO authenticated;
