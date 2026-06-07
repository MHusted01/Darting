-- Add username column to users table
alter table public.users
  add column if not exists username text;

-- Case-insensitive uniqueness; partial WHERE allows multiple existing NULL rows
create unique index if not exists users_username_lower_key
  on public.users (lower(username))
  where username is not null;

-- Fix: restrict authenticated role to profile columns only (no email).
-- The broad "Authenticated users can read profiles" policy added in the
-- social migration allows row reads but cannot restrict columns — so
-- authenticated clients can SELECT email FROM users directly. Revoking
-- the blanket SELECT and re-granting on specific columns closes that gap
-- without breaking PostgREST joins or the user_profiles view.
revoke select on public.users from authenticated;
grant select (id, first_name, last_name, avatar_url, username, created_at, updated_at) on public.users to authenticated;

-- Recreate user_profiles view (column set changed — must drop first)
drop view if exists public.user_profiles;
create view public.user_profiles
  with (security_invoker = true) as
  select id, first_name, last_name, avatar_url, username
  from public.users;
grant select on public.user_profiles to authenticated;

-- Recreate search_users_by_email RPC (return type changed — must drop first)
drop function if exists public.search_users_by_email(text);
create or replace function public.search_users_by_email(search_email text)
returns table(id text, first_name text, last_name text, avatar_url text, username text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select id, first_name, last_name, avatar_url, username
  from public.users
  where lower(email) = lower(trim(search_email));
$$;
grant execute on function public.search_users_by_email(text) to authenticated;
