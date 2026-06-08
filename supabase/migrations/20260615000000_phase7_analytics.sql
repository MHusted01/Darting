-- Phase 7: Analytics columns + context tag + public stats RPC

-- Add context to game_sessions (casual/tournament/practice/realtime)
ALTER TABLE public.game_sessions
  ADD COLUMN context text NOT NULL DEFAULT 'casual'
    CHECK (context IN ('casual', 'tournament', 'practice', 'realtime'));

-- Add per-player analytics blobs to game_players
ALTER TABLE public.game_players
  ADD COLUMN analytics jsonb,
  ADD COLUMN dart_counts jsonb,
  ADD COLUMN checkout_stats jsonb;

-- Grant write access to authenticated users (same pattern as other columns)
GRANT UPDATE (context) ON TABLE public.game_sessions TO authenticated;
GRANT UPDATE (analytics, dart_counts, checkout_stats) ON TABLE public.game_players TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get_player_public_stats
-- Returns aggregate KPIs for a player, visible only to friends and club members.
-- Security definer bypasses RLS — only aggregates are exposed, no raw dart data.
-- ---------------------------------------------------------------------------
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
  -- Scalar aggregates: games played, overall avg, win rate
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT gs.id)::int                                            AS games_played,
      AVG(gp.three_dart_avg) FILTER (WHERE gp.three_dart_avg IS NOT NULL)  AS avg_three_dart_avg,
      AVG(CASE WHEN gp.is_winner THEN 1.0 ELSE 0.0 END)                    AS win_rate
    FROM public.game_sessions gs
    JOIN public.game_players gp
      ON gp.game_session_id = gs.id AND gp.user_id = u.id
    WHERE gs.created_by = u.id
      AND gs.status = 'completed'
      AND gs.context != 'practice'
  ) agg ON TRUE
  -- Per-slug averages, built as a jsonb object in a single subquery
  LEFT JOIN LATERAL (
    SELECT
      jsonb_object_agg(slug_row.game_slug, slug_row.slug_avg)
        FILTER (WHERE slug_row.slug_avg IS NOT NULL)                        AS per_game_kpis
    FROM (
      SELECT
        gs2.game_slug,
        AVG(gp2.three_dart_avg) FILTER (WHERE gp2.three_dart_avg IS NOT NULL) AS slug_avg
      FROM public.game_sessions gs2
      JOIN public.game_players gp2
        ON gp2.game_session_id = gs2.id AND gp2.user_id = u.id
      WHERE gs2.created_by = u.id
        AND gs2.status = 'completed'
        AND gs2.context != 'practice'
      GROUP BY gs2.game_slug
    ) slug_row
  ) slug_kpis ON TRUE
  WHERE u.id = p_user_id
    AND (
      -- Viewing own profile
      auth.jwt() ->> 'sub' = p_user_id
      -- Or is an accepted friend
      OR EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND (
            (requester_id = auth.jwt() ->> 'sub' AND addressee_id = p_user_id)
            OR (addressee_id = auth.jwt() ->> 'sub' AND requester_id = p_user_id)
          )
      )
      -- Or shares a club
      OR EXISTS (
        SELECT 1
        FROM public.club_memberships cm1
        JOIN public.club_memberships cm2 ON cm1.club_id = cm2.club_id
        WHERE cm1.user_id = auth.jwt() ->> 'sub'
          AND cm2.user_id = p_user_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_player_public_stats(text) TO authenticated;
