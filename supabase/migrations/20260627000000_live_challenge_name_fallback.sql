-- Fix: get_live_club_challenges returned an empty display name when a user has
-- no first/last name; fall back to username, then a generic label.
CREATE OR REPLACE FUNCTION public.get_live_club_challenges(p_club_id uuid)
RETURNS TABLE (
  id               uuid,
  game_slug        text,
  settings         jsonb,
  challenger_id    text,
  challenger_name  text,
  challengee_id    text,
  challengee_name  text,
  turn_count       integer,
  created_at       timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    gc.id,
    gc.game_slug,
    gc.settings,
    gc.challenger_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(u1.first_name, '') || ' ' || COALESCE(u1.last_name, '')), ''),
      u1.username,
      'Player'
    ) AS challenger_name,
    gc.challengee_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(u2.first_name, '') || ' ' || COALESCE(u2.last_name, '')), ''),
      u2.username,
      'Player'
    ) AS challengee_name,
    gc.turn_count,
    gc.created_at
  FROM public.game_challenges gc
  JOIN public.users u1 ON u1.id = gc.challenger_id
  JOIN public.users u2 ON u2.id = gc.challengee_id
  WHERE public.is_club_member(p_club_id, auth.jwt() ->> 'sub')
    AND gc.status = 'in_progress'
    AND public.is_club_member(p_club_id, gc.challenger_id)
    AND public.is_club_member(p_club_id, gc.challengee_id)
  ORDER BY gc.created_at DESC;
$$;
