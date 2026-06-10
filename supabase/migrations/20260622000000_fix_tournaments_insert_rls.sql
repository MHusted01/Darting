-- Fix tournaments INSERT RLS.
--
-- The previous version inlined the membership check as:
--   cm.club_id = club_id
-- Inside the EXISTS subquery, unqualified `club_id` resolves to cm.club_id
-- (the nearest FROM scope), making the check a tautology and allowing any
-- club admin to insert a tournament for any club_id.
--
-- Fix: use public.is_club_admin(club_id, sub). The function is SECURITY DEFINER
-- so PostgreSQL will not inline it. Its argument `club_id` is evaluated in the
-- outer WITH CHECK scope where it unambiguously refers to the new tournaments row.
-- The function body compares against its parameter `club` (not `club_id`), so
-- there is no column-name collision inside the function either.
-- Also add created_by = auth.jwt() ->> 'sub' to anchor on the inserting user,
-- matching the pattern used by clubs and club_invites INSERT policies.

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
