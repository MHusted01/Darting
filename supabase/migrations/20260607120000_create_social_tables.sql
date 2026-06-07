-- ============================================================
-- Phase 4: Social tables — friendships, clubs, memberships, invites
-- ============================================================

-- ------------------------------------------------------------
-- friendships
-- ------------------------------------------------------------
create table public.friendships (
  id          uuid    primary key default gen_random_uuid(),
  requester_id text   not null references public.users(id) on delete cascade,
  addressee_id text   not null references public.users(id) on delete cascade,
  status      text    not null default 'pending'
                      check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint no_self_friendship check (requester_id <> addressee_id)
);

-- Canonical pair index prevents both (A→B) and (B→A) from coexisting.
-- Uses least/greatest so the pair is always stored in a consistent order.
create unique index unique_friendship_canonical
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_requester_idx on public.friendships (requester_id);
create index friendships_addressee_idx on public.friendships (addressee_id);

create trigger set_friendships_updated_at
  before update on public.friendships
  for each row execute function public.handle_updated_at();

alter table public.friendships enable row level security;

create policy "Users can see their own friendships"
  on public.friendships for select
  using (requester_id = auth.jwt() ->> 'sub' or addressee_id = auth.jwt() ->> 'sub');

create policy "Users can send friend requests as themselves"
  on public.friendships for insert
  with check (requester_id = auth.jwt() ->> 'sub');

create policy "Addressee can accept or decline"
  on public.friendships for update
  using (addressee_id = auth.jwt() ->> 'sub');

create policy "Either party can remove the friendship"
  on public.friendships for delete
  using (requester_id = auth.jwt() ->> 'sub' or addressee_id = auth.jwt() ->> 'sub');

-- ------------------------------------------------------------
-- clubs (table only — RLS policies that use is_club_admin come later)
-- ------------------------------------------------------------
create table public.clubs (
  id          uuid    primary key default gen_random_uuid(),
  name        text    not null,
  description text,
  created_by  text    not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index clubs_created_by_idx on public.clubs (created_by);

create trigger set_clubs_updated_at
  before update on public.clubs
  for each row execute function public.handle_updated_at();

alter table public.clubs enable row level security;

-- ------------------------------------------------------------
-- club_memberships (table only — RLS policies that use is_club_admin come later)
-- ------------------------------------------------------------
create table public.club_memberships (
  id        uuid  primary key default gen_random_uuid(),
  club_id   uuid  not null references public.clubs(id) on delete cascade,
  user_id   text  not null references public.users(id) on delete cascade,
  role      text  not null default 'member'
                  check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  constraint unique_club_member unique (club_id, user_id)
);

create index club_memberships_club_idx on public.club_memberships (club_id);
create index club_memberships_user_idx on public.club_memberships (user_id);

alter table public.club_memberships enable row level security;

-- ------------------------------------------------------------
-- Helper: is_club_admin
-- Defined AFTER club_memberships so the LANGUAGE SQL function can
-- resolve the table reference at parse time (PostgreSQL resolves
-- SQL function bodies when the function is created, not at call time).
-- security definer avoids recursive RLS evaluation when this function
-- is called from within a club_memberships policy.
-- ------------------------------------------------------------
create function public.is_club_admin(club uuid, uid text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.club_memberships
    where club_id = club and user_id = uid and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- clubs RLS policies (require is_club_admin)
-- ------------------------------------------------------------
create policy "Clubs are publicly searchable"
  on public.clubs for select
  using (true);

create policy "Users can create clubs as themselves"
  on public.clubs for insert
  with check (created_by = auth.jwt() ->> 'sub');

create policy "Admins can update their club"
  on public.clubs for update
  using (public.is_club_admin(id, auth.jwt() ->> 'sub'));

create policy "Admins can delete their club"
  on public.clubs for delete
  using (public.is_club_admin(id, auth.jwt() ->> 'sub'));

-- ------------------------------------------------------------
-- club_memberships RLS policies (require is_club_admin)
-- ------------------------------------------------------------
create policy "Memberships are publicly visible"
  on public.club_memberships for select
  using (true);

create policy "Users can join clubs as themselves"
  on public.club_memberships for insert
  with check (
    user_id = auth.jwt() ->> 'sub'
    and (
      -- Regular join: always member role
      role = 'member'
      -- Initial admin: only the club creator may insert themselves as admin
      or (role = 'admin' and exists (
        select 1 from public.clubs
        where id = club_id and created_by = auth.jwt() ->> 'sub'
      ))
    )
  );

create policy "Members can leave; admins can remove members"
  on public.club_memberships for delete
  using (
    user_id = auth.jwt() ->> 'sub'
    or public.is_club_admin(club_id, auth.jwt() ->> 'sub')
  );

-- ------------------------------------------------------------
-- club_invites
-- ------------------------------------------------------------
create table public.club_invites (
  id          uuid  primary key default gen_random_uuid(),
  club_id     uuid  not null references public.clubs(id) on delete cascade,
  invited_by  text  not null references public.users(id) on delete cascade,
  invitee_id  text  not null references public.users(id) on delete cascade,
  status      text  not null default 'pending'
                    check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz not null default now(),
  constraint unique_club_invite unique (club_id, invitee_id)
);

create index club_invites_invitee_idx on public.club_invites (invitee_id);
create index club_invites_club_idx    on public.club_invites (club_id);

alter table public.club_invites enable row level security;

create policy "Invitee and inviter can see the invite"
  on public.club_invites for select
  using (invitee_id = auth.jwt() ->> 'sub' or invited_by = auth.jwt() ->> 'sub');

create policy "Admins can send invites"
  on public.club_invites for insert
  with check (
    invited_by = auth.jwt() ->> 'sub'
    and public.is_club_admin(club_id, auth.jwt() ->> 'sub')
  );

create policy "Invitee can update invite status"
  on public.club_invites for update
  using (invitee_id = auth.jwt() ->> 'sub');

-- ------------------------------------------------------------
-- search_users_by_email RPC
-- Exact-match only (no ilike) to prevent account enumeration.
-- Security definer so the email column can be read without
-- exposing it through the user_profiles view or users RLS.
-- Returns the same shape as user_profiles for consistent mapping.
-- ------------------------------------------------------------
create function public.search_users_by_email(search_email text)
returns table(id text, first_name text, last_name text, avatar_url text)
language sql security definer stable as $$
  select id, first_name, last_name, avatar_url
  from public.users
  where lower(email) = lower(trim(search_email));
$$;

grant execute on function public.search_users_by_email(text) to authenticated;

-- ------------------------------------------------------------
-- user_profiles view (safe public search surface — no email)
-- ------------------------------------------------------------
create view public.user_profiles
  with (security_invoker = true) as
  select id, first_name, last_name, avatar_url
  from public.users;

grant select on public.user_profiles to authenticated;

-- ------------------------------------------------------------
-- get_club_leaderboard RPC
-- Security definer: bypasses per-user RLS on game_sessions so
-- aggregate stats can be computed across club members. Access is
-- gated by a membership check — callers who are not members of
-- the requested club receive an empty result set.
-- ------------------------------------------------------------
create function public.get_club_leaderboard(p_club_id uuid)
returns table(
  club_id          uuid,
  user_id          text,
  first_name       text,
  last_name        text,
  avatar_url       text,
  games_played     int,
  avg_three_dart_avg float8
)
language sql security definer stable as $$
  select
    cm.club_id,
    cm.user_id,
    u.first_name,
    u.last_name,
    u.avatar_url,
    count(distinct gs.id)::int                                          as games_played,
    avg(gp.three_dart_avg) filter (where gp.three_dart_avg is not null) as avg_three_dart_avg
  from public.club_memberships cm
  join public.users u on u.id = cm.user_id
  left join public.game_sessions gs
    on gs.created_by = cm.user_id and gs.status = 'completed'
  left join public.game_players gp
    on gp.game_session_id = gs.id and gp.user_id = cm.user_id
  where cm.club_id = p_club_id
    and exists (
      select 1 from public.club_memberships
      where club_id = p_club_id and user_id = auth.jwt() ->> 'sub'
    )
  group by cm.club_id, cm.user_id, u.first_name, u.last_name, u.avatar_url
  order by avg_three_dart_avg desc nulls last;
$$;

grant execute on function public.get_club_leaderboard(uuid) to authenticated;

-- ------------------------------------------------------------
-- Expand users RLS so authenticated users can read profiles
-- (required for friend/member search via user_profiles view).
-- The existing "read own data" policy is kept; permissive SELECT
-- policies are OR'd together by Postgres.
-- ------------------------------------------------------------
create policy "Authenticated users can read profiles"
  on public.users for select
  using (auth.role() = 'authenticated');
