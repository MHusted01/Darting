-- Realtime matches sync one cloud session per participant (both devices upsert
-- their own copy so each player gets stats). Each copy contains both players in
-- game_players, so RPCs that join game_players.user_id across all sessions see
-- every realtime match twice. Restrict realtime sessions to the player's own
-- copy: (gs.context <> 'realtime' OR gs.created_by = player). Casual and
-- tournament sessions are unaffected (single copy, possibly hosted on another
-- player's device). get_club_leaderboard already filters created_by and needs
-- no change.

-- ─── get_friends_activity ─────────────────────────────────────────────────────
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
  JOIN public.game_sessions gs
    ON gs.id = gp.game_session_id
    AND gs.status = 'completed'
    AND (gs.context <> 'realtime' OR gs.created_by = friend_id.id)
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

-- ─── get_player_recent_games ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_player_recent_games(
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
  JOIN public.game_sessions gs
    ON gs.id = gp.game_session_id
    AND gs.status = 'completed'
    AND (gs.context <> 'realtime' OR gs.created_by = p_user_id)
  WHERE gp.user_id = p_user_id
    AND public.can_view_player(auth.jwt() ->> 'sub', p_user_id)
  ORDER BY gs.completed_at DESC
  LIMIT p_limit;
$$;

-- ─── get_player_public_stats ──────────────────────────────────────────────────
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
      AND (gs.context <> 'realtime' OR gs.created_by = u.id)
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
        AND (gs2.context <> 'realtime' OR gs2.created_by = u.id)
      WHERE gp2.user_id = u.id
      GROUP BY gs2.game_slug
    ) slug_row
  ) slug_kpis ON TRUE
  WHERE u.id = p_user_id
    AND public.can_view_player(auth.jwt() ->> 'sub', p_user_id);
$$;
