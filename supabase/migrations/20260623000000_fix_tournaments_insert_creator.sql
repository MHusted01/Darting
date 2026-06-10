-- Fix tournaments INSERT RLS: add clubs.created_by as a direct admission path.
--
-- The existing policy uses public.is_club_admin which checks club_memberships
-- for role = 'admin'. However, createClub() is non-atomic: it inserts the club
-- first, then the admin membership row. If the membership insert fails (any
-- transient reason), clubs.created_by is correctly set but is_club_admin finds
-- no row and returns false, causing the INSERT to violate RLS.
--
-- The actual source of truth for who is the club admin is clubs.created_by,
-- which is what the club_memberships INSERT policy itself uses to determine
-- who may insert an admin-role membership. Adding this as an OR condition
-- eliminates the membership indirection and matches the authoritative oracle.
--
-- Ambiguity analysis:
--   SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.created_by = ...
--   - c.id        : explicitly clubs.id via alias c
--   - club_id     : unqualified; clubs has no club_id column, so this resolves
--                   to the outer WITH CHECK scope (new tournaments.club_id) ✓
--   - c.created_by: explicitly clubs.created_by via alias c ✓
--
-- Cross-club spoofing is prevented by:
--   created_by = auth.jwt() ->> 'sub'   (cannot insert as another user)
--   c.id = club_id                       (clubs.created_by must match the
--                                         exact target club_id, not any club)

DROP POLICY IF EXISTS "Tournaments creatable by club/division admin" ON public.tournaments;

CREATE POLICY "Tournaments creatable by club/division admin"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    created_by = auth.jwt() ->> 'sub' AND
    (
      (
        club_id IS NOT NULL AND (
          public.is_club_admin(club_id, auth.jwt() ->> 'sub') OR
          EXISTS (
            SELECT 1 FROM public.clubs c
            WHERE c.id = club_id
              AND c.created_by = auth.jwt() ->> 'sub'
          )
        )
      ) OR
      (
        division_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.divisions d
          WHERE d.id = division_id
            AND d.admin_user_id = auth.jwt() ->> 'sub'
        )
      )
    )
  );

-- Diagnostic: run these in the Supabase SQL editor to verify policy predicates
-- for a specific user. Replace <user_id> and <club_id> with real values.
--
-- SELECT auth.jwt() ->> 'sub';
-- SELECT public.is_club_admin('<club_id>'::uuid, '<user_id>');
-- SELECT id, created_by FROM public.clubs WHERE id = '<club_id>'::uuid;
-- SELECT * FROM public.club_memberships WHERE club_id = '<club_id>'::uuid AND user_id = '<user_id>';
