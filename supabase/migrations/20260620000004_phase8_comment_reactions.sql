-- Comment reactions — one of each emoji per user per comment

CREATE TABLE public.club_comment_reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid        NOT NULL REFERENCES public.club_post_comments(id) ON DELETE CASCADE,
  user_id    text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('thumbs_up', 'bullseye', 'fire')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_comment_reaction_type_per_user UNIQUE (comment_id, user_id, type)
);

CREATE INDEX club_comment_reactions_comment_idx ON public.club_comment_reactions (comment_id);

ALTER TABLE public.club_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view comment reactions"
  ON public.club_comment_reactions FOR SELECT
  USING (
    public.is_club_member(
      (SELECT cp.club_id FROM public.club_post_comments c
       JOIN public.club_posts cp ON cp.id = c.post_id
       WHERE c.id = comment_id),
      auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Club members can react to comments as themselves"
  ON public.club_comment_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub'
    AND public.is_club_member(
      (SELECT cp.club_id FROM public.club_post_comments c
       JOIN public.club_posts cp ON cp.id = c.post_id
       WHERE c.id = comment_id),
      auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can remove their own comment reaction"
  ON public.club_comment_reactions FOR DELETE
  USING (
    user_id = auth.jwt() ->> 'sub'
    AND public.is_club_member(
      (SELECT cp.club_id FROM public.club_post_comments c
       JOIN public.club_posts cp ON cp.id = c.post_id
       WHERE c.id = comment_id),
      auth.jwt() ->> 'sub'
    )
  );

-- Recreate get_post_comments to include reaction counts and caller's reactions
DROP FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int);

CREATE FUNCTION public.get_post_comments(
  p_post_id           uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL,
  p_limit             int         DEFAULT 31
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
  author_avatar_url    text,
  thumbs_up_count      int,
  bullseye_count       int,
  fire_count           int,
  my_reactions         text[]
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    c.id,
    c.post_id,
    c.author_id,
    c.body,
    c.created_at,
    u.first_name   AS author_first_name,
    u.last_name    AS author_last_name,
    u.username     AS author_username,
    u.avatar_url   AS author_avatar_url,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'thumbs_up')::int AS thumbs_up_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'bullseye')::int  AS bullseye_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.type = 'fire')::int      AS fire_count,
    COALESCE(
      (SELECT array_agg(r2.type)
       FROM public.club_comment_reactions r2
       WHERE r2.comment_id = c.id AND r2.user_id = auth.jwt() ->> 'sub'),
      '{}'::text[]
    ) AS my_reactions
  FROM public.club_post_comments c
  JOIN public.users u ON u.id = c.author_id
  JOIN public.club_posts cp ON cp.id = c.post_id
  LEFT JOIN public.club_comment_reactions r ON r.comment_id = c.id
  WHERE c.post_id = p_post_id
    AND EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = cp.club_id AND user_id = auth.jwt() ->> 'sub'
    )
    AND (
      p_cursor_created_at IS NULL
      OR (c.created_at, c.id) > (p_cursor_created_at, p_cursor_id)
    )
  GROUP BY c.id, c.post_id, c.author_id, c.body, c.created_at,
           u.first_name, u.last_name, u.username, u.avatar_url
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int) TO authenticated;
