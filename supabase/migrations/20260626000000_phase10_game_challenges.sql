-- Phase 10: Real-time multiplayer — game_challenges table, RLS, RPCs, realtime auth

-- ─── game_challenges ──────────────────────────────────────────────────────────
CREATE TABLE public.game_challenges (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id         text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challengee_id         text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_slug             text        NOT NULL,
  settings              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status                text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','in_progress','complete','cancelled','abandoned')),
  current_turn_user_id  text,
  turn_count            integer     NOT NULL DEFAULT 0,
  last_turn             jsonb,
  winner_user_id        text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (challenger_id <> challengee_id)
);

CREATE INDEX game_challenges_challengee_idx ON public.game_challenges (challengee_id, status);
CREATE INDEX game_challenges_challenger_idx ON public.game_challenges (challenger_id, status);

ALTER TABLE public.game_challenges ENABLE ROW LEVEL SECURITY;

-- Row-local participant SELECT: safe for INSERT ... RETURNING (no self-referential helpers)
CREATE POLICY "Participants can view their challenges"
  ON public.game_challenges FOR SELECT
  USING (auth.jwt() ->> 'sub' IN (challenger_id, challengee_id));

-- Spectators: friends / club-mutuals of both participants may view live games only
CREATE POLICY "Spectators can view in-progress challenges"
  ON public.game_challenges FOR SELECT
  USING (
    status = 'in_progress'
    AND public.can_view_player(auth.jwt() ->> 'sub', challenger_id)
    AND public.can_view_player(auth.jwt() ->> 'sub', challengee_id)
  );

-- Eligibility: challenger must be self, target must be a friend or club-mutual
CREATE POLICY "Users can challenge friends and club mutuals"
  ON public.game_challenges FOR INSERT
  WITH CHECK (
    challenger_id = auth.jwt() ->> 'sub'
    AND status = 'pending'
    AND public.can_view_player(challenger_id, challengee_id)
  );

-- Clients may only ever write the status column; turn state is service-role only
GRANT SELECT, INSERT ON public.game_challenges TO authenticated;
GRANT UPDATE (status) ON public.game_challenges TO authenticated;

CREATE POLICY "Challengee can respond to pending challenges"
  ON public.game_challenges FOR UPDATE
  USING (challengee_id = auth.jwt() ->> 'sub' AND status = 'pending')
  WITH CHECK (challengee_id = auth.jwt() ->> 'sub' AND status IN ('accepted', 'declined'));

CREATE POLICY "Challenger can cancel pending challenges"
  ON public.game_challenges FOR UPDATE
  USING (challenger_id = auth.jwt() ->> 'sub' AND status = 'pending')
  WITH CHECK (challenger_id = auth.jwt() ->> 'sub' AND status = 'cancelled');

-- ─── start_challenge ──────────────────────────────────────────────────────────
-- Either participant may start an accepted challenge; challenger throws first.
-- FOR UPDATE + status re-check serializes the double-start race; idempotent.
CREATE FUNCTION public.start_challenge(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_challenge public.game_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_challenge
  FROM public.game_challenges
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % not found', p_id;
  END IF;

  IF auth.jwt() ->> 'sub' NOT IN (v_challenge.challenger_id, v_challenge.challengee_id) THEN
    RAISE EXCEPTION 'Not a participant of challenge %', p_id;
  END IF;

  IF v_challenge.status = 'in_progress' THEN
    RETURN;
  END IF;

  IF v_challenge.status <> 'accepted' THEN
    RAISE EXCEPTION 'Challenge % is not accepted (status: %)', p_id, v_challenge.status;
  END IF;

  UPDATE public.game_challenges
  SET status = 'in_progress',
      current_turn_user_id = v_challenge.challenger_id,
      updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_challenge(uuid) TO authenticated;

-- ─── abandon_challenge ────────────────────────────────────────────────────────
CREATE FUNCTION public.abandon_challenge(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_challenge public.game_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_challenge
  FROM public.game_challenges
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % not found', p_id;
  END IF;

  IF auth.jwt() ->> 'sub' NOT IN (v_challenge.challenger_id, v_challenge.challengee_id) THEN
    RAISE EXCEPTION 'Not a participant of challenge %', p_id;
  END IF;

  IF v_challenge.status IN ('abandoned', 'complete') THEN
    RETURN;
  END IF;

  IF v_challenge.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Challenge % is not in progress (status: %)', p_id, v_challenge.status;
  END IF;

  UPDATE public.game_challenges
  SET status = 'abandoned', updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.abandon_challenge(uuid) TO authenticated;

-- ─── advance_challenge_turn ───────────────────────────────────────────────────
-- Atomic turn-order compare-and-swap used by the validate-turn edge function.
-- The function authenticates via auth.jwt() (PostgREST verifies the forwarded
-- Clerk JWT). Returns a status string so the edge function can map rejections
-- to HTTP 409 without exposing exception details.
-- The turn payload is stored on last_turn in the same UPDATE, so delivery to
-- the opponent and spectators rides the postgres_changes event for this row —
-- a validated turn can never advance state without also being delivered.
-- last_turn is built server-side from the validated arguments (never from a
-- caller-supplied blob), so a direct RPC call cannot advance turn state while
-- storing a mismatched or unparseable payload.
CREATE FUNCTION public.advance_challenge_turn(
  p_id uuid,
  p_turn_seq integer,
  p_is_complete boolean,
  p_winner_user_id text,
  p_user_id text,
  p_darts jsonb,
  p_scores jsonb
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_challenge public.game_challenges%ROWTYPE;
  v_caller text := auth.jwt() ->> 'sub';
BEGIN
  SELECT * INTO v_challenge
  FROM public.game_challenges
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_caller IS NULL OR v_caller NOT IN (v_challenge.challenger_id, v_challenge.challengee_id) THEN
    RETURN 'not_participant';
  END IF;

  IF p_user_id <> v_caller THEN
    RETURN 'user_mismatch';
  END IF;

  IF v_challenge.status <> 'in_progress' THEN
    RETURN 'not_in_progress';
  END IF;

  IF v_challenge.current_turn_user_id <> v_caller THEN
    RETURN 'not_your_turn';
  END IF;

  IF v_challenge.turn_count <> p_turn_seq - 1 THEN
    RETURN 'stale_seq';
  END IF;

  IF p_is_complete
     AND p_winner_user_id IS NOT NULL
     AND p_winner_user_id NOT IN (v_challenge.challenger_id, v_challenge.challengee_id) THEN
    RETURN 'invalid_winner';
  END IF;

  IF p_darts IS NULL
     OR jsonb_typeof(p_darts) <> 'array'
     OR jsonb_array_length(p_darts) NOT BETWEEN 1 AND 3
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_darts) AS d
       WHERE jsonb_typeof(d) <> 'object'
          OR jsonb_typeof(d -> 'segment') <> 'number'
          OR jsonb_typeof(d -> 'multiplier') <> 'number'
          OR (d ->> 'segment')::numeric <> floor((d ->> 'segment')::numeric)
          OR (d ->> 'multiplier')::numeric <> floor((d ->> 'multiplier')::numeric)
          OR (d ->> 'segment')::int NOT BETWEEN 0 AND 25
          OR ((d ->> 'segment')::int > 20 AND (d ->> 'segment')::int <> 25)
          OR (d ->> 'multiplier')::int NOT BETWEEN 0 AND 3
     ) THEN
    RETURN 'invalid_turn';
  END IF;

  IF p_scores IS NULL
     OR jsonb_typeof(p_scores) <> 'object'
     OR EXISTS (
       SELECT 1 FROM jsonb_each(p_scores) AS s
       WHERE jsonb_typeof(s.value) <> 'number'
     ) THEN
    RETURN 'invalid_turn';
  END IF;

  UPDATE public.game_challenges
  SET turn_count = p_turn_seq,
      last_turn = jsonb_build_object(
        'challengeId', p_id::text,
        'turnSeq', p_turn_seq,
        'userId', v_caller,
        'darts', p_darts,
        'isComplete', p_is_complete,
        'winnerUserId', p_winner_user_id,
        'scores', p_scores
      ),
      current_turn_user_id = CASE
        WHEN p_is_complete THEN NULL
        WHEN v_caller = v_challenge.challenger_id THEN v_challenge.challengee_id
        ELSE v_challenge.challenger_id
      END,
      status = CASE WHEN p_is_complete THEN 'complete' ELSE status END,
      winner_user_id = CASE WHEN p_is_complete THEN p_winner_user_id ELSE winner_user_id END,
      updated_at = now()
  WHERE id = p_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_challenge_turn(uuid, integer, boolean, text, text, jsonb, jsonb) TO authenticated;

-- ─── get_live_club_challenges ─────────────────────────────────────────────────
-- Live games where both participants belong to the given club; caller must be a member.
CREATE FUNCTION public.get_live_club_challenges(p_club_id uuid)
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
    TRIM(COALESCE(u1.first_name, '') || ' ' || COALESCE(u1.last_name, '')) AS challenger_name,
    gc.challengee_id,
    TRIM(COALESCE(u2.first_name, '') || ' ' || COALESCE(u2.last_name, '')) AS challengee_name,
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

GRANT EXECUTE ON FUNCTION public.get_live_club_challenges(uuid) TO authenticated;

-- ─── Realtime authorization for challenge:<id> channels ──────────────────────
-- SELECT: participants always; spectators only while the game is in progress.
CREATE POLICY "Challenge channel receive"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE 'challenge:%'
    AND EXISTS (
      SELECT 1 FROM public.game_challenges gc
      WHERE gc.id::text = split_part(realtime.topic(), ':', 2)
        AND (
          auth.jwt() ->> 'sub' IN (gc.challenger_id, gc.challengee_id)
          OR (
            gc.status = 'in_progress'
            AND public.can_view_player(auth.jwt() ->> 'sub', gc.challenger_id)
            AND public.can_view_player(auth.jwt() ->> 'sub', gc.challengee_id)
          )
        )
    )
  );

-- INSERT: presence tracking only, participants only. Turn delivery rides
-- postgres_changes on game_challenges.last_turn (written by the validate-turn
-- edge function via advance_challenge_turn), so spectators and participants
-- alike cannot forge turn events on the channel.
CREATE POLICY "Challenge channel presence track"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'challenge:%'
    AND realtime.messages.extension = 'presence'
    AND EXISTS (
      SELECT 1 FROM public.game_challenges gc
      WHERE gc.id::text = split_part(realtime.topic(), ':', 2)
        AND auth.jwt() ->> 'sub' IN (gc.challenger_id, gc.challengee_id)
    )
  );

-- Status changes (accept/start/complete/decline/cancel/abandon) reach clients
-- as postgres_changes UPDATE events, RLS-filtered by the SELECT policies above.
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_challenges;
