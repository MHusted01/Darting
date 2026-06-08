-- Phase 8: Add 'mentions' key to notification_prefs for all existing users
-- and update the column default to include it.

UPDATE public.users
SET notification_prefs = notification_prefs || '{"mentions":true}'::jsonb
WHERE NOT (notification_prefs ? 'mentions');

ALTER TABLE public.users
  ALTER COLUMN notification_prefs
  SET DEFAULT '{"friend_requests":true,"club_invites":true,"tournament_updates":true,"match_challenges":true,"mentions":true}'::jsonb;
