-- Phase 9: Tournaments
-- Adds divisions, tournaments, participants, rounds, matches tables
-- plus RPCs for detail/listing/standings and the complete_tournament_match RPC

-- ─── Divisions ────────────────────────────────────────────────────────────────

CREATE TABLE public.divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  admin_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.division_clubs (
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  PRIMARY KEY (division_id, club_id)
);

-- ─── Tournaments ──────────────────────────────────────────────────────────────

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  division_id uuid REFERENCES public.divisions(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  format text NOT NULL CHECK (format IN ('league', 'cup', 'weekly', 'round_robin')),
  game_slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  start_date timestamptz,
  end_date timestamptz,
  settings jsonb NOT NULL DEFAULT '{"legsPerMatch":1,"doubleOut":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_owner_check CHECK (
    (club_id IS NOT NULL AND division_id IS NULL) OR
    (club_id IS NULL AND division_id IS NOT NULL)
  )
);

CREATE INDEX tournaments_club_id_idx ON public.tournaments (club_id);
CREATE INDEX tournaments_division_id_idx ON public.tournaments (division_id);
CREATE INDEX tournaments_status_idx ON public.tournaments (status);

-- ─── Participants ─────────────────────────────────────────────────────────────

CREATE TABLE public.tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  seeding integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated')),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX tournament_participants_tournament_id_idx ON public.tournament_participants (tournament_id);
CREATE INDEX tournament_participants_user_id_idx ON public.tournament_participants (user_id);

-- ─── Rounds ───────────────────────────────────────────────────────────────────

CREATE TABLE public.tournament_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  UNIQUE (tournament_id, round_number)
);

CREATE INDEX tournament_rounds_tournament_id_idx ON public.tournament_rounds (tournament_id);

-- ─── Matches ──────────────────────────────────────────────────────────────────

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.tournament_rounds(id) ON DELETE CASCADE,
  participant1_id uuid REFERENCES public.tournament_participants(id) ON DELETE SET NULL,
  participant2_id uuid REFERENCES public.tournament_participants(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES public.tournament_participants(id) ON DELETE SET NULL,
  game_session_id uuid REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'bye')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_session_id)
);

CREATE INDEX tournament_matches_round_id_idx ON public.tournament_matches (round_id);
CREATE INDEX tournament_matches_participant1_id_idx ON public.tournament_matches (participant1_id);
CREATE INDEX tournament_matches_participant2_id_idx ON public.tournament_matches (participant2_id);

-- ─── Helper functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.is_tournament_visible(t_id uuid, uid text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    LEFT JOIN public.club_memberships cm ON cm.club_id = t.club_id AND cm.user_id = uid
    LEFT JOIN public.division_clubs dc ON dc.division_id = t.division_id AND dc.status = 'accepted'
    LEFT JOIN public.club_memberships cm2 ON cm2.club_id = dc.club_id AND cm2.user_id = uid
    WHERE t.id = t_id AND (cm.user_id IS NOT NULL OR cm2.user_id IS NOT NULL)
  )
$$;

CREATE FUNCTION public.is_tournament_admin(t_id uuid, uid text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    LEFT JOIN public.club_memberships cm ON cm.club_id = t.club_id AND cm.user_id = uid AND cm.role = 'admin'
    LEFT JOIN public.divisions d ON d.id = t.division_id AND d.admin_user_id = uid
    WHERE t.id = t_id AND (cm.user_id IS NOT NULL OR d.id IS NOT NULL)
  )
$$;

-- Returns true when c_id is the tournament's own club (single-club) or an accepted division club
CREATE FUNCTION public.is_valid_tournament_club(t_id uuid, c_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = t_id AND (
      t.club_id = c_id OR
      EXISTS (
        SELECT 1 FROM public.division_clubs dc
        WHERE dc.division_id = t.division_id AND dc.club_id = c_id AND dc.status = 'accepted'
      )
    )
  )
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.division_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- divisions: visible to division admin; writable by admin
CREATE POLICY "Divisions visible to admin"
  ON public.divisions FOR SELECT
  USING (admin_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Divisions creatable by any authenticated user"
  ON public.divisions FOR INSERT
  WITH CHECK (admin_user_id = auth.jwt() ->> 'sub');

-- division_clubs: visible to clubs in the division
CREATE POLICY "Division clubs visible to club members"
  ON public.division_clubs FOR SELECT
  USING (
    public.is_club_member(club_id, auth.jwt() ->> 'sub') OR
    EXISTS (SELECT 1 FROM public.divisions d WHERE d.id = division_id AND d.admin_user_id = auth.jwt() ->> 'sub')
  );

CREATE POLICY "Division clubs insertable by division admin"
  ON public.division_clubs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.divisions d WHERE d.id = division_id AND d.admin_user_id = auth.jwt() ->> 'sub')
  );

CREATE POLICY "Division clubs updatable by club admin"
  ON public.division_clubs FOR UPDATE
  USING (public.is_club_admin(club_id, auth.jwt() ->> 'sub'));

-- tournaments: visible to club/division members; writable by admins
CREATE POLICY "Tournaments visible to members"
  ON public.tournaments FOR SELECT
  USING (public.is_tournament_visible(id, auth.jwt() ->> 'sub'));

CREATE POLICY "Tournaments creatable by club/division admin"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    (club_id IS NOT NULL AND public.is_club_admin(club_id, auth.jwt() ->> 'sub')) OR
    (division_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.divisions d WHERE d.id = division_id AND d.admin_user_id = auth.jwt() ->> 'sub'
    ))
  );

CREATE POLICY "Tournaments updatable by admin"
  ON public.tournaments FOR UPDATE
  USING (public.is_tournament_admin(id, auth.jwt() ->> 'sub'));

-- tournament_participants: visible to tournament members; self-register
CREATE POLICY "Participants visible to tournament members"
  ON public.tournament_participants FOR SELECT
  USING (public.is_tournament_visible(tournament_id, auth.jwt() ->> 'sub'));

CREATE POLICY "Participants self-register"
  ON public.tournament_participants FOR INSERT
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub' AND
    public.is_tournament_visible(tournament_id, auth.jwt() ->> 'sub') AND
    (
      club_id IS NULL OR
      (
        public.is_club_member(club_id, auth.jwt() ->> 'sub') AND
        public.is_valid_tournament_club(tournament_id, club_id)
      )
    )
  );

CREATE POLICY "Participants self-remove"
  ON public.tournament_participants FOR DELETE
  USING (user_id = auth.jwt() ->> 'sub');

-- rounds and matches: SELECT for all members; INSERT for admins only (start tournament flow)
CREATE POLICY "Rounds visible to tournament members"
  ON public.tournament_rounds FOR SELECT
  USING (public.is_tournament_visible(tournament_id, auth.jwt() ->> 'sub'));

CREATE POLICY "Rounds insertable by tournament admin"
  ON public.tournament_rounds FOR INSERT
  WITH CHECK (public.is_tournament_admin(tournament_id, auth.jwt() ->> 'sub'));

CREATE POLICY "Matches visible to tournament members"
  ON public.tournament_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_rounds tr
      WHERE tr.id = round_id AND public.is_tournament_visible(tr.tournament_id, auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Matches insertable by tournament admin"
  ON public.tournament_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_rounds tr
      WHERE tr.id = round_id AND public.is_tournament_admin(tr.tournament_id, auth.jwt() ->> 'sub')
    )
  );

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

-- List clubs tournaments with cursor pagination (keyset on created_at DESC, id DESC)
CREATE FUNCTION public.get_club_tournaments(
  p_club_id uuid,
  p_cursor text DEFAULT NULL,
  p_limit integer DEFAULT 21
)
RETURNS TABLE (
  id uuid,
  club_id uuid,
  division_id uuid,
  created_by text,
  name text,
  format text,
  game_slug text,
  status text,
  start_date timestamptz,
  end_date timestamptz,
  settings jsonb,
  participant_count bigint,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    t.id, t.club_id, t.division_id, t.created_by, t.name, t.format,
    t.game_slug, t.status, t.start_date, t.end_date, t.settings,
    COUNT(tp.id) AS participant_count,
    t.created_at
  FROM public.tournaments t
  LEFT JOIN public.tournament_participants tp ON tp.tournament_id = t.id
  WHERE t.club_id = p_club_id
    AND (
      p_cursor IS NULL OR
      t.created_at < (((p_cursor::jsonb) ->> 'createdAt')::timestamptz) OR
      (t.created_at = (((p_cursor::jsonb) ->> 'createdAt')::timestamptz) AND t.id::text < ((p_cursor::jsonb) ->> 'id'))
    )
  GROUP BY t.id
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT p_limit
$$;

-- Get active tournaments across all clubs the current user belongs to
CREATE FUNCTION public.get_my_active_tournaments()
RETURNS TABLE (
  id uuid,
  club_id uuid,
  division_id uuid,
  created_by text,
  name text,
  format text,
  game_slug text,
  status text,
  start_date timestamptz,
  end_date timestamptz,
  settings jsonb,
  participant_count bigint,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    t.id, t.club_id, t.division_id, t.created_by, t.name, t.format,
    t.game_slug, t.status, t.start_date, t.end_date, t.settings,
    COUNT(tp.id) AS participant_count,
    t.created_at
  FROM public.tournaments t
  LEFT JOIN public.tournament_participants tp ON tp.tournament_id = t.id
  WHERE t.status = 'active'
    AND (
      -- single-club tournament: user is a club member
      (t.club_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.club_memberships cm
        WHERE cm.club_id = t.club_id AND cm.user_id = auth.jwt() ->> 'sub'
      ))
      OR
      -- division tournament: user is a member of any accepted club in the division
      (t.division_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.division_clubs dc
        JOIN public.club_memberships cm ON cm.club_id = dc.club_id
        WHERE dc.division_id = t.division_id
          AND dc.status = 'accepted'
          AND cm.user_id = auth.jwt() ->> 'sub'
      ))
    )
  GROUP BY t.id
  ORDER BY t.created_at DESC
  LIMIT 20
$$;

-- Full tournament detail: tournament + participants + rounds with nested matches (JSONB)
CREATE FUNCTION public.get_tournament_detail(p_tournament_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT public.is_tournament_visible(p_tournament_id, auth.jwt() ->> 'sub') THEN
    RAISE EXCEPTION 'Not authorized to view this tournament';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'tournament', to_jsonb(t) || jsonb_build_object(
        'participant_count', (SELECT COUNT(*) FROM public.tournament_participants WHERE tournament_id = p_tournament_id)
      ),
      'participants', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', tp.id,
          'tournament_id', tp.tournament_id,
          'user_id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'avatar_url', u.avatar_url,
          'username', u.username,
          'club_id', tp.club_id,
          'seeding', tp.seeding,
          'status', tp.status
        ) ORDER BY tp.seeding NULLS LAST, tp.id), '[]'::jsonb)
        FROM public.tournament_participants tp
        JOIN public.users u ON u.id = tp.user_id
        WHERE tp.tournament_id = p_tournament_id
      ),
      'rounds', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', tr.id,
            'tournament_id', tr.tournament_id,
            'round_number', tr.round_number,
            'status', tr.status,
            'matches', (
              SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', tm.id,
                'round_id', tm.round_id,
                'participant1_id', tm.participant1_id,
                'participant2_id', tm.participant2_id,
                'winner_id', tm.winner_id,
                'game_session_id', tm.game_session_id,
                'status', tm.status,
                'created_at', tm.created_at
              ) ORDER BY tm.created_at), '[]'::jsonb)
              FROM public.tournament_matches tm
              WHERE tm.round_id = tr.id
            )
          ) ORDER BY tr.round_number
        ), '[]'::jsonb)
        FROM public.tournament_rounds tr
        WHERE tr.tournament_id = p_tournament_id
      )
    )
    FROM public.tournaments t
    WHERE t.id = p_tournament_id
  );
END;
$$;

-- Complete a match: update winner, link session, advance round if all done
CREATE FUNCTION public.complete_tournament_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_session_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_round_id uuid;
  v_tournament_id uuid;
  v_tournament_format text;
  v_tournament_game_slug text;
  v_all_done boolean;
  v_caller_authorized boolean;
  v_next_round_number integer;
  v_next_round_id uuid;
BEGIN
  -- Idempotency: if already completed, do nothing
  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE id = p_match_id AND status = 'completed') THEN
    RETURN;
  END IF;

  -- Validate that winner is one of the match participants
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE id = p_match_id
      AND (participant1_id = p_winner_id OR participant2_id = p_winner_id)
  ) THEN
    RAISE EXCEPTION 'Winner % is not a participant in match %', p_winner_id, p_match_id;
  END IF;

  -- Resolve tournament_id, format, game_slug for downstream checks
  SELECT t.id, t.format, t.game_slug, tr.id
  INTO v_tournament_id, v_tournament_format, v_tournament_game_slug, v_round_id
  FROM public.tournament_matches tm
  JOIN public.tournament_rounds tr ON tr.id = tm.round_id
  JOIN public.tournaments t ON t.id = tr.tournament_id
  WHERE tm.id = p_match_id;

  -- Validate session: must be completed with correct game slug and involve both match participants
  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = p_session_id
      AND gs.status = 'completed'
      AND gs.game_slug = v_tournament_game_slug
  ) THEN
    RAISE EXCEPTION 'Session % is not a valid completed session for this tournament', p_session_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_players gp
    JOIN public.tournament_participants tp ON tp.user_id = gp.user_id
    JOIN public.tournament_matches tm ON tm.id = p_match_id AND tm.participant1_id = tp.id
    WHERE gp.game_session_id = p_session_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.game_players gp
    JOIN public.tournament_participants tp ON tp.user_id = gp.user_id
    JOIN public.tournament_matches tm ON tm.id = p_match_id AND tm.participant2_id = tp.id
    WHERE gp.game_session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'Session % does not involve both participants of match %', p_session_id, p_match_id;
  END IF;

  -- Validate p_winner_id is the actual game winner (is_winner = true in game_players)
  IF NOT EXISTS (
    SELECT 1 FROM public.game_players gp
    JOIN public.tournament_participants tp ON tp.user_id = gp.user_id AND tp.id = p_winner_id
    WHERE gp.game_session_id = p_session_id AND gp.is_winner = true
  ) THEN
    RAISE EXCEPTION 'Winner % did not win session %', p_winner_id, p_session_id;
  END IF;

  -- Caller must be a match participant or tournament admin
  SELECT (
    EXISTS (
      SELECT 1 FROM public.tournament_matches tm
      JOIN public.tournament_participants tp
        ON tp.id = tm.participant1_id OR tp.id = tm.participant2_id
      WHERE tm.id = p_match_id AND tp.user_id = auth.jwt() ->> 'sub'
    )
    OR public.is_tournament_admin(v_tournament_id, auth.jwt() ->> 'sub')
  ) INTO v_caller_authorized;

  IF NOT v_caller_authorized THEN
    RAISE EXCEPTION 'Not authorized to complete match %', p_match_id;
  END IF;

  -- Validate session is not already linked to a different match
  IF EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE game_session_id = p_session_id AND id <> p_match_id
  ) THEN
    RAISE EXCEPTION 'Session % is already linked to another match', p_session_id;
  END IF;

  -- Update match
  UPDATE public.tournament_matches
  SET winner_id = p_winner_id,
      game_session_id = p_session_id,
      status = 'completed'
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  -- Check if all non-bye matches in the round are complete
  SELECT NOT EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE round_id = v_round_id AND status NOT IN ('completed', 'bye')
  ) INTO v_all_done;

  IF v_all_done THEN
    UPDATE public.tournament_rounds SET status = 'completed' WHERE id = v_round_id;

    -- For cup format: generate next round from winners if 2+ participants remain
    IF v_tournament_format = 'cup' THEN
      SELECT COUNT(*) > 1 INTO v_all_done  -- reuse boolean as "should generate next round"
      FROM public.tournament_matches
      WHERE round_id = v_round_id;

      IF v_all_done THEN
        SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_next_round_number
        FROM public.tournament_rounds WHERE tournament_id = v_tournament_id;

        INSERT INTO public.tournament_rounds (tournament_id, round_number, status)
        VALUES (v_tournament_id, v_next_round_number, 'active')
        RETURNING id INTO v_next_round_id;

        -- Pair winners: first vs last, second vs second-to-last (seeded bracket order)
        INSERT INTO public.tournament_matches (round_id, participant1_id, participant2_id, status)
        WITH ordered AS (
          SELECT
            CASE WHEN status = 'bye' THEN participant1_id ELSE winner_id END AS pid,
            ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS pos,
            COUNT(*) OVER () AS total
          FROM public.tournament_matches
          WHERE round_id = v_round_id
        )
        SELECT v_next_round_id, a.pid, b.pid, 'pending'
        FROM ordered a
        JOIN ordered b ON b.pos = a.total - 1 - a.pos
        WHERE a.pos < b.pos;
      ELSE
        -- Single winner remaining: cup tournament is complete
        UPDATE public.tournaments SET status = 'completed' WHERE id = v_tournament_id;
      END IF;
    END IF;
  END IF;

  -- Update game_sessions context to tournament
  UPDATE public.game_sessions
  SET context = 'tournament'
  WHERE id = p_session_id;
END;
$$;

-- ─── Weekly challenge reset (pg_cron) ─────────────────────────────────────────
-- Requires pg_cron extension. Skip if not available.
-- Enable in Supabase dashboard: Database → Extensions → pg_cron
-- After enabling, uncomment and run:
--
-- CREATE FUNCTION public.reset_weekly_challenges()
-- RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   UPDATE public.tournaments
--   SET status = 'completed'
--   WHERE format = 'weekly' AND status = 'active'
--     AND (end_date IS NULL OR end_date < now());
-- END;
-- $$;
--
-- SELECT cron.schedule(
--   'reset-weekly-challenges',
--   '0 0 * * 1',
--   $$ SELECT public.reset_weekly_challenges(); $$
-- );
