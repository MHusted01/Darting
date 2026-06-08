-- Add parent_comment_id to support one-level-deep replies
ALTER TABLE public.club_post_comments
  ADD COLUMN parent_comment_id uuid REFERENCES public.club_post_comments(id) ON DELETE CASCADE;

CREATE INDEX club_post_comments_parent_idx ON public.club_post_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- Enforce: parent must be a top-level comment on the same post.
-- Prevents depth > 1 and cross-post parent references.
CREATE FUNCTION public.validate_comment_parent()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.club_post_comments
      WHERE id = NEW.parent_comment_id
        AND post_id = NEW.post_id
        AND parent_comment_id IS NULL
    ) THEN
      RAISE EXCEPTION 'parent_comment_id must reference a top-level comment on the same post';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_comment_parent
  BEFORE INSERT ON public.club_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_comment_parent();

-- Recreate get_post_comments to include parent_comment_id in return shape.
DROP FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int);

CREATE FUNCTION public.get_post_comments(
  p_post_id           uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL,
  p_limit             int         DEFAULT 50
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
    AND EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = cp.club_id AND user_id = auth.jwt() ->> 'sub'
    )
    AND (
      p_cursor_created_at IS NULL
      OR (c.created_at, c.id) > (p_cursor_created_at, p_cursor_id)
    )
  GROUP BY c.id, c.post_id, c.parent_comment_id, c.author_id, c.body, c.created_at,
           u.first_name, u.last_name, u.username, u.avatar_url
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_comments(uuid, timestamptz, uuid, int) TO authenticated;
