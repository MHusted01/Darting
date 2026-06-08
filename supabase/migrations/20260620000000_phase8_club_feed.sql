-- Phase 8: Club social feed tables, RLS, and RPCs

-- ─── is_club_member helper ────────────────────────────────────────────────────
-- Security definer avoids recursive RLS evaluation (mirrors is_club_admin).
CREATE FUNCTION public.is_club_member(club uuid, uid text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = club AND user_id = uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, text) TO authenticated;

-- ─── club_posts ───────────────────────────────────────────────────────────────
CREATE TABLE public.club_posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id        text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body             text        NOT NULL,
  game_session_id  uuid        REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX club_posts_pagination_idx ON public.club_posts (club_id, created_at DESC, id DESC);
CREATE INDEX club_posts_author_idx     ON public.club_posts (author_id);

ALTER TABLE public.club_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view posts"
  ON public.club_posts FOR SELECT
  USING (public.is_club_member(club_id, auth.jwt() ->> 'sub'));

CREATE POLICY "Club members can create posts as themselves"
  ON public.club_posts FOR INSERT
  WITH CHECK (
    author_id = auth.jwt() ->> 'sub'
    AND public.is_club_member(club_id, auth.jwt() ->> 'sub')
    AND (
      game_session_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.game_players
        WHERE game_session_id = club_posts.game_session_id
          AND user_id = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Author or admin can delete post"
  ON public.club_posts FOR DELETE
  USING (
    author_id = auth.jwt() ->> 'sub'
    OR public.is_club_admin(club_id, auth.jwt() ->> 'sub')
  );

-- ─── club_post_comments ───────────────────────────────────────────────────────
CREATE TABLE public.club_post_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
  author_id  text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX club_post_comments_post_idx ON public.club_post_comments (post_id, created_at, id);

ALTER TABLE public.club_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view comments"
  ON public.club_post_comments FOR SELECT
  USING (
    public.is_club_member(
      (SELECT club_id FROM public.club_posts WHERE id = post_id),
      auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Club members can comment as themselves"
  ON public.club_post_comments FOR INSERT
  WITH CHECK (
    author_id = auth.jwt() ->> 'sub'
    AND public.is_club_member(
      (SELECT club_id FROM public.club_posts WHERE id = post_id),
      auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Author or admin can delete comment"
  ON public.club_post_comments FOR DELETE
  USING (
    author_id = auth.jwt() ->> 'sub'
    OR public.is_club_admin(
      (SELECT club_id FROM public.club_posts WHERE id = post_id),
      auth.jwt() ->> 'sub'
    )
  );

-- ─── club_post_reactions ──────────────────────────────────────────────────────
CREATE TABLE public.club_post_reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
  user_id    text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('thumbs_up', 'bullseye', 'fire')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_reaction_per_user UNIQUE (post_id, user_id)
);

CREATE INDEX club_post_reactions_post_idx ON public.club_post_reactions (post_id);

ALTER TABLE public.club_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view reactions"
  ON public.club_post_reactions FOR SELECT
  USING (
    public.is_club_member(
      (SELECT club_id FROM public.club_posts WHERE id = post_id),
      auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Club members can react as themselves"
  ON public.club_post_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub'
    AND public.is_club_member(
      (SELECT club_id FROM public.club_posts WHERE id = post_id),
      auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can update their own reaction"
  ON public.club_post_reactions FOR UPDATE
  USING (
    user_id = auth.jwt() ->> 'sub'
    AND public.is_club_member(
      (SELECT club_id FROM public.club_posts WHERE id = post_id),
      auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can remove their own reaction"
  ON public.club_post_reactions FOR DELETE
  USING (
    user_id = auth.jwt() ->> 'sub'
    AND public.is_club_member(
      (SELECT club_id FROM public.club_posts WHERE id = post_id),
      auth.jwt() ->> 'sub'
    )
  );

-- ─── get_club_feed RPC ────────────────────────────────────────────────────────
-- Returns posts with author info, attached-game summary, aggregated reactions,
-- and comment count. Fetches p_limit + 1 so the caller can detect hasMore.
-- Keyset cursor on (created_at DESC, id DESC).
CREATE FUNCTION public.get_club_feed(
  p_club_id          uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id        uuid        DEFAULT NULL,
  p_limit            int         DEFAULT 21
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
  author_avatar_url text,
  thumbs_up_count     int,
  bullseye_count      int,
  fire_count          int,
  my_reaction         text,
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
    u.avatar_url                                                AS author_avatar_url,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'thumbs_up')::int  AS thumbs_up_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'bullseye')::int  AS bullseye_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'fire')::int      AS fire_count,
    MAX(r.type) FILTER (WHERE r.user_id = auth.jwt() ->> 'sub')   AS my_reaction,
    COUNT(DISTINCT cc.id)::int                                     AS comment_count,
    CASE WHEN gp.user_id IS NOT NULL THEN gs.game_slug ELSE NULL END AS game_slug,
    gp.three_dart_avg                                               AS game_three_dart_avg
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

-- ─── get_post_comments RPC ────────────────────────────────────────────────────
CREATE FUNCTION public.get_post_comments(
  p_post_id          uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id        uuid        DEFAULT NULL,
  p_limit            int         DEFAULT 31
)
RETURNS TABLE (
  id                   uuid,
  post_id              uuid,
  author_id            text,
  body                 text,
  created_at           timestamptz,
  author_first_name    text,
  author_last_name     text,
  author_username      text,
  author_avatar_url text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    c.id,
    c.post_id,
    c.author_id,
    c.body,
    c.created_at,
    u.first_name  AS author_first_name,
    u.last_name   AS author_last_name,
    u.username    AS author_username,
    u.avatar_url AS author_avatar_url
  FROM public.club_post_comments c
  JOIN public.users u ON u.id = c.author_id
  JOIN public.club_posts cp ON cp.id = c.post_id
  WHERE c.post_id = p_post_id
    AND EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = cp.club_id AND user_id = auth.jwt() ->> 'sub'
    )
    AND (
      p_cursor_created_at IS NULL
      OR (c.created_at, c.id) > (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int) TO authenticated;
