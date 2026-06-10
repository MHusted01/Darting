-- Phase 9 hardening: deterministic bracket pairing, concurrency-safe match
-- completion, non-cup tournament completion, and tighter UPDATE policies.
--
-- 1. bracket_slot: matches in a round are inserted in one statement, so they
--    share created_at and ROW_NUMBER() OVER (ORDER BY created_at) was
--    non-deterministic. Add a persistent slot per round, backfill existing rows
--    deterministically, and pair winners by slot order.
--
-- 2. complete_tournament_match: the idempotency check ran before any row lock,
--    so concurrent callers (both players' devices poll the results screen)
--    could both pass it and double-run advancement. Lock the match row FOR
--    UPDATE first, then re-check status. Round advancement is additionally
--    serialized on the round row: without it, two transactions completing the
--    last two matches of a round could each see the other's update as
--    uncommitted, both conclude the round is unfinished, and strand it with no
--    next round generated. The round lock makes the last committer see the
--    full round; the round-status re-check prevents duplicate advancement.
--    Also set non-cup tournaments (league/round_robin) to 'completed' when
--    their final round finishes.
--
-- 3. division_clubs UPDATE: restrict updatable columns to status via
--    column-level grants so a club admin cannot move their accepted row to a
--    different division, and add an explicit WITH CHECK mirroring USING.
--
-- 4. tournaments UPDATE: add an explicit WITH CHECK mirroring USING, and
--    restrict the updatable columns for authenticated to the app's actual
--    update surface (status, name, start_date, end_date, settings). Identity
--    and scope columns (created_by, club_id, division_id, format, game_slug)
--    stay immutable through the API: created_by anchors the visibility
--    policies, and the others would let an admin reshape or move a tournament
--    after creation. complete_tournament_match is SECURITY DEFINER and is not
--    affected by these grants.

-- ─── Part 1: bracket_slot column + backfill ───────────────────────────────────

ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS bracket_slot integer;

UPDATE public.tournament_matches tm
SET bracket_slot = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY round_id ORDER BY created_at, id) AS rn
  FROM public.tournament_matches
) sub
WHERE tm.id = sub.id AND tm.bracket_slot IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_round_slot_idx
  ON public.tournament_matches (round_id, bracket_slot);

-- ─── Part 2: concurrency-safe, format-complete complete_tournament_match ──────

CREATE OR REPLACE FUNCTION public.complete_tournament_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_session_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status text;
  v_round_status text;
  v_round_id uuid;
  v_tournament_id uuid;
  v_tournament_format text;
  v_tournament_game_slug text;
  v_all_done boolean;
  v_caller_authorized boolean;
  v_next_round_number integer;
  v_next_round_id uuid;
BEGIN
  -- Serialize concurrent callers on the match row, then re-check idempotency.
  SELECT status INTO v_status
  FROM public.tournament_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  IF v_status = 'completed' THEN
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

  -- Serialize round advancement: concurrent completions of different matches
  -- in the same round queue here, and each subsequent statement then runs with
  -- a fresh snapshot that includes the prior committer's match update.
  SELECT status INTO v_round_status
  FROM public.tournament_rounds
  WHERE id = v_round_id
  FOR UPDATE;

  -- Check if all non-bye matches in the round are complete
  SELECT NOT EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE round_id = v_round_id AND status NOT IN ('completed', 'bye')
  ) INTO v_all_done;

  IF v_all_done AND v_round_status <> 'completed' THEN
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

        -- Pair winners by persistent bracket slot: first vs last, second vs
        -- second-to-last (seeded bracket order)
        INSERT INTO public.tournament_matches (round_id, participant1_id, participant2_id, status, bracket_slot)
        WITH ordered AS (
          SELECT
            CASE WHEN status = 'bye' THEN participant1_id ELSE winner_id END AS pid,
            ROW_NUMBER() OVER (ORDER BY bracket_slot NULLS LAST, created_at, id) - 1 AS pos,
            COUNT(*) OVER () AS total
          FROM public.tournament_matches
          WHERE round_id = v_round_id
        )
        SELECT v_next_round_id, a.pid, b.pid, 'pending', a.pos + 1
        FROM ordered a
        JOIN ordered b ON b.pos = a.total - 1 - a.pos
        WHERE a.pos < b.pos;
      ELSE
        -- Single winner remaining: cup tournament is complete
        UPDATE public.tournaments SET status = 'completed' WHERE id = v_tournament_id;
      END IF;
    ELSE
      -- League / round robin: all rounds done means the tournament is complete
      IF NOT EXISTS (
        SELECT 1 FROM public.tournament_rounds
        WHERE tournament_id = v_tournament_id AND status <> 'completed'
      ) THEN
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

-- ─── Part 3: division_clubs UPDATE restricted to status ───────────────────────

REVOKE UPDATE ON public.division_clubs FROM authenticated, anon;
GRANT UPDATE (status) ON public.division_clubs TO authenticated;

DROP POLICY IF EXISTS "Division clubs updatable by club admin" ON public.division_clubs;

CREATE POLICY "Division clubs updatable by club admin"
  ON public.division_clubs FOR UPDATE
  USING (public.is_club_admin(club_id, auth.jwt() ->> 'sub'))
  WITH CHECK (public.is_club_admin(club_id, auth.jwt() ->> 'sub'));

-- ─── Part 4: tournaments UPDATE restricted to mutable columns ─────────────────

REVOKE UPDATE ON public.tournaments FROM authenticated, anon;
GRANT UPDATE (status, name, start_date, end_date, settings) ON public.tournaments TO authenticated;

DROP POLICY IF EXISTS "Tournaments updatable by admin" ON public.tournaments;

CREATE POLICY "Tournaments updatable by admin"
  ON public.tournaments FOR UPDATE
  USING (public.is_tournament_admin(id, auth.jwt() ->> 'sub'))
  WITH CHECK (public.is_tournament_admin(id, auth.jwt() ->> 'sub'));
