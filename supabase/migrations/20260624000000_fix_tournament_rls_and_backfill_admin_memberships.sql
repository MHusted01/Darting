-- Fix tournament creation RLS, backfill missing admin membership rows, and
-- replace the self-referential tournaments SELECT policy.
--
-- Actual root cause of the persistent "new row violates row-level security
-- policy" error: createTournament() uses INSERT ... RETURNING (.select('id')).
-- Under RLS, PostgreSQL applies the SELECT policy's USING expression to the
-- returned new row and raises that same error when it fails. The SELECT policy
-- was is_tournament_visible(id, sub) — a STABLE function that re-queries
-- public.tournaments for the just-inserted row. A STABLE function runs with the
-- calling statement's snapshot, which cannot see rows inserted by the same
-- command, so the check returned false for every insert regardless of admin
-- status. The INSERT WITH CHECK itself was passing all along.
--
-- Three-part fix:
--
-- 1. Backfill: for every club whose creator has no membership row at all (the
--    non-atomic createClub failure mode), insert an admin row. A creator who
--    already holds a role='member' row is intentionally left as member
--    (ON CONFLICT DO NOTHING) — that state means they legitimately left and
--    rejoined; clubs.created_by is not a permanent admin oracle.
--
-- 2. INSERT policy: revert to is_club_admin-only, removing the clubs.created_by
--    bypass introduced in 20260623000000, which was inconsistent with the
--    update/delete/invite policies that all require current admin membership.
--
-- 3. SELECT policy: replace is_tournament_visible(id, ...) with a row-local
--    predicate over the row's own columns (created_by, club_id, division_id)
--    that never re-queries tournaments, so it evaluates correctly on RETURNING.
--
-- 4. is_tournament_visible: align with the Part 3 policy by adding the creator
--    and division-admin paths. SECURITY DEFINER RPCs (get_tournament_detail)
--    and the participants/rounds/matches policies all gate on this helper, so
--    without this a division admin could pass the table policy but still be
--    rejected by the detail RPC.
--
-- 5. get_club_tournaments: the RPC is SECURITY DEFINER and had no caller check,
--    letting any authenticated user list any club's tournaments by id. Require
--    club membership, matching the table SELECT policy for club tournaments.
--
-- 6. get_my_active_tournaments: replace the inlined visibility logic (club
--    member / accepted division club member only) with is_tournament_visible,
--    so creators and division admins see their active tournaments on the home
--    list with exactly the same semantics as the detail RPC and table policy.
--
-- 7. Participants self-register: the INSERT policy gated eligibility on
--    is_tournament_visible, so widening that helper in Part 4 would have let a
--    division admin or creator with no relevant club membership self-register
--    with club_id NULL. Replace the visibility check with an explicit
--    membership-based eligibility predicate (club member for single-club
--    tournaments, accepted-division-club member for division tournaments),
--    keeping visibility and participant eligibility as separate concepts.
--    club_id stays nullable: the app does not send club representation yet,
--    and when provided it is still validated by is_club_member +
--    is_valid_tournament_club.

-- ─── Part 1: backfill ─────────────────────────────────────────────────────────

INSERT INTO public.club_memberships (club_id, user_id, role)
SELECT c.id, c.created_by, 'admin'
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.club_memberships cm
  WHERE cm.club_id = c.id
    AND cm.user_id = c.created_by
    AND cm.role = 'admin'
)
ON CONFLICT ON CONSTRAINT unique_club_member DO NOTHING;

-- ─── Part 2: revert INSERT policy to is_club_admin-only ───────────────────────

DROP POLICY IF EXISTS "Tournaments creatable by club/division admin" ON public.tournaments;

CREATE POLICY "Tournaments creatable by club/division admin"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    created_by = auth.jwt() ->> 'sub' AND
    (
      (club_id IS NOT NULL AND public.is_club_admin(club_id, auth.jwt() ->> 'sub')) OR
      (division_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.divisions d
        WHERE d.id = division_id
          AND d.admin_user_id = auth.jwt() ->> 'sub'
      ))
    )
  );

-- ─── Part 3: row-local SELECT policy ──────────────────────────────────────────

DROP POLICY IF EXISTS "Tournaments visible to members" ON public.tournaments;

CREATE POLICY "Tournaments visible to members"
  ON public.tournaments FOR SELECT
  USING (
    created_by = auth.jwt() ->> 'sub' OR
    (club_id IS NOT NULL AND public.is_club_member(club_id, auth.jwt() ->> 'sub')) OR
    (division_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.divisions d
        WHERE d.id = tournaments.division_id
          AND d.admin_user_id = auth.jwt() ->> 'sub'
      ) OR
      EXISTS (
        SELECT 1 FROM public.division_clubs dc
        WHERE dc.division_id = tournaments.division_id
          AND dc.status = 'accepted'
          AND public.is_club_member(dc.club_id, auth.jwt() ->> 'sub')
      )
    ))
  );

-- ─── Part 4: align is_tournament_visible with the SELECT policy ───────────────

CREATE OR REPLACE FUNCTION public.is_tournament_visible(t_id uuid, uid text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = t_id AND (
      t.created_by = uid OR
      (t.club_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.club_memberships cm
        WHERE cm.club_id = t.club_id AND cm.user_id = uid
      )) OR
      (t.division_id IS NOT NULL AND (
        EXISTS (
          SELECT 1 FROM public.divisions d
          WHERE d.id = t.division_id AND d.admin_user_id = uid
        ) OR
        EXISTS (
          SELECT 1 FROM public.division_clubs dc
          JOIN public.club_memberships cm2 ON cm2.club_id = dc.club_id AND cm2.user_id = uid
          WHERE dc.division_id = t.division_id AND dc.status = 'accepted'
        )
      ))
    )
  )
$$;

-- ─── Part 5: require club membership in get_club_tournaments ──────────────────

CREATE OR REPLACE FUNCTION public.get_club_tournaments(
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
    AND public.is_club_member(p_club_id, auth.jwt() ->> 'sub')
    AND (
      p_cursor IS NULL OR
      t.created_at < (((p_cursor::jsonb) ->> 'createdAt')::timestamptz) OR
      (t.created_at = (((p_cursor::jsonb) ->> 'createdAt')::timestamptz) AND t.id::text < ((p_cursor::jsonb) ->> 'id'))
    )
  GROUP BY t.id
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT p_limit
$$;

-- ─── Part 6: get_my_active_tournaments uses is_tournament_visible ─────────────

CREATE OR REPLACE FUNCTION public.get_my_active_tournaments()
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
    AND public.is_tournament_visible(t.id, auth.jwt() ->> 'sub')
  GROUP BY t.id
  ORDER BY t.created_at DESC
  LIMIT 20
$$;

-- ─── Part 7: membership-based participant self-register eligibility ───────────

DROP POLICY IF EXISTS "Participants self-register" ON public.tournament_participants;

CREATE POLICY "Participants self-register"
  ON public.tournament_participants FOR INSERT
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub' AND
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND (
        (t.club_id IS NOT NULL AND public.is_club_member(t.club_id, auth.jwt() ->> 'sub')) OR
        (t.division_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.division_clubs dc
          WHERE dc.division_id = t.division_id
            AND dc.status = 'accepted'
            AND public.is_club_member(dc.club_id, auth.jwt() ->> 'sub')
        ))
      )
    ) AND
    (
      club_id IS NULL OR (
        public.is_club_member(club_id, auth.jwt() ->> 'sub') AND
        public.is_valid_tournament_club(tournament_id, club_id)
      )
    )
  );

-- ─── Diagnostic (run in SQL editor to verify a specific user/club) ────────────
-- Replace <user_id> and <club_id> with real values after applying:
--
-- SELECT public.is_club_admin('<club_id>'::uuid, '<user_id>');
-- SELECT role FROM public.club_memberships
--   WHERE club_id = '<club_id>'::uuid AND user_id = '<user_id>';
-- SELECT id, created_by FROM public.clubs WHERE id = '<club_id>'::uuid;
