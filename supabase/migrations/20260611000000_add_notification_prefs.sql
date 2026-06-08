ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb
  NOT NULL DEFAULT '{"friend_requests":true,"club_invites":true,"tournament_updates":true,"match_challenges":true}'::jsonb;

-- The UPDATE row-level policy "Users can update own push_token" already allows
-- authenticated users to update their own row. We only need column-level grants
-- to expose this new column for both reads and writes.
-- Note: 20260608090000_add_username.sql revoked the blanket SELECT on users and
-- re-granted only specific columns. notification_prefs must be explicitly added.
GRANT SELECT (notification_prefs) ON public.users TO authenticated;
GRANT UPDATE (notification_prefs) ON public.users TO authenticated;
