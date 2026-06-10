-- Phase 12a: 3-dart averages are an X01 metric. Restrict every cloud aggregate
-- of game_players.three_dart_avg to game_slug = 'x01' so Cricket/ATC/etc.
-- session values no longer pollute the headline averages. Also aligns
-- get_club_leaderboard with the participation-based, practice-excluded,
-- realtime-deduped semantics already used by get_player_public_stats.

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
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
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
      AVG(gp.three_dart_avg) FILTER (
        WHERE gp.three_dart_avg IS NOT NULL AND gs.game_slug = 'x01'
      )                                                                     AS avg_three_dart_avg,
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
        AVG(gp2.three_dart_avg) FILTER (
          WHERE gp2.three_dart_avg IS NOT NULL AND gs2.game_slug = 'x01'
        ) AS slug_avg
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

-- ─── get_club_leaderboard ─────────────────────────────────────────────────────
-- Note: games_played counts ALL completed game types (participation metric),
-- while avg_three_dart_avg is x01-only (3DA is an X01 metric). A member who
-- only plays Cricket shows games_played > 0 with a null average — intended.
CREATE OR REPLACE FUNCTION public.get_club_leaderboard(p_club_id uuid)
RETURNS TABLE(
  club_id            uuid,
  user_id            text,
  first_name         text,
  last_name          text,
  avatar_url         text,
  games_played       int,
  avg_three_dart_avg float8
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    cm.club_id,
    cm.user_id,
    u.first_name,
    u.last_name,
    u.avatar_url,
    COUNT(DISTINCT gs.id)::int                                            AS games_played,
    AVG(gp.three_dart_avg) FILTER (
      WHERE gp.three_dart_avg IS NOT NULL AND gs.game_slug = 'x01'
    )                                                                     AS avg_three_dart_avg
  FROM public.club_memberships cm
  JOIN public.users u ON u.id = cm.user_id
  LEFT JOIN public.game_players gp ON gp.user_id = cm.user_id
  LEFT JOIN public.game_sessions gs
    ON gs.id = gp.game_session_id
    AND gs.status = 'completed'
    AND gs.context != 'practice'
    AND (gs.context <> 'realtime' OR gs.created_by = cm.user_id)
  WHERE cm.club_id = p_club_id
    AND EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = p_club_id AND user_id = auth.jwt() ->> 'sub'
    )
  GROUP BY cm.club_id, cm.user_id, u.first_name, u.last_name, u.avatar_url
  ORDER BY avg_three_dart_avg DESC NULLS LAST;
$$;

-- ─── get_friends_three_dart_avgs ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_friends_three_dart_avgs()
RETURNS TABLE (
  friend_id          text,
  avg_three_dart_avg float8
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    friend_ids.id                                                         AS friend_id,
    AVG(gp.three_dart_avg) FILTER (WHERE gp.three_dart_avg IS NOT NULL)   AS avg_three_dart_avg
  FROM public.friendships f
  JOIN LATERAL (
    SELECT CASE
      WHEN f.requester_id = auth.jwt() ->> 'sub' THEN f.addressee_id
      ELSE f.requester_id
    END AS id
  ) friend_ids ON TRUE
  JOIN public.game_players gp ON gp.user_id = friend_ids.id
  JOIN public.game_sessions gs
    ON gs.id = gp.game_session_id
    AND gs.status = 'completed'
    AND gs.game_slug = 'x01'
    AND gs.context != 'practice'
    AND (gs.context <> 'realtime' OR gs.created_by = friend_ids.id)
  WHERE (f.requester_id = auth.jwt() ->> 'sub' OR f.addressee_id = auth.jwt() ->> 'sub')
    AND f.status = 'accepted'
  GROUP BY friend_ids.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_friends_three_dart_avgs() TO authenticated;
