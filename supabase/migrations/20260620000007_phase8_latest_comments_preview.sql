-- Dedicated RPC for the inline comment preview on each post card.
-- Returns the N most recent TOP-LEVEL comments (DESC) so the preview
-- is always accurate without depending on infinite-scroll page state.
-- Excludes replies (parent_comment_id IS NOT NULL) so they are never
-- shown as standalone preview rows.

CREATE FUNCTION public.get_latest_post_comments(
  p_post_id uuid,
  p_limit   int DEFAULT 2
)
RETURNS TABLE (
  id                   uuid,
  post_id              uuid,
  parent_comment_id    uuid,
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
    c.parent_comment_id,
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
    AND c.parent_comment_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = cp.club_id AND user_id = auth.jwt() ->> 'sub'
    )
  GROUP BY c.id, c.post_id, c.parent_comment_id, c.author_id, c.body, c.created_at,
           u.first_name, u.last_name, u.username, u.avatar_url
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_latest_post_comments(uuid, int) TO authenticated;
