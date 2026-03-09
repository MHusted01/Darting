-- Game sessions (synced from device after completion)
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  status text not null default 'completed',
  created_by text not null references public.users(id) on delete cascade,
  config jsonb,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

create policy "Users can read own game sessions"
  on public.game_sessions for select
  using (created_by = auth.jwt() ->> 'sub');

create policy "Users can insert own game sessions"
  on public.game_sessions for insert
  with check (created_by = auth.jwt() ->> 'sub');

create index game_sessions_created_by_idx
  on public.game_sessions(created_by);

-- Game players in a session
create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id text references public.users(id) on delete set null,
  player_name text not null,
  player_order integer not null,
  final_score integer,
  is_winner boolean not null default false,
  game_state jsonb,
  unique (game_session_id, player_order)
);

alter table public.game_players enable row level security;

create policy "Users can read game players for own sessions"
  on public.game_players for select
  using (
    game_session_id in (
      select id from public.game_sessions
      where created_by = auth.jwt() ->> 'sub'
    )
  );

create policy "Users can insert game players for own sessions"
  on public.game_players for insert
  with check (
    game_session_id in (
      select id from public.game_sessions
      where created_by = auth.jwt() ->> 'sub'
    )
  );

create index game_players_session_id_idx
  on public.game_players(game_session_id);

create index game_players_user_id_idx
  on public.game_players(user_id);

-- Individual turns in a session
create table public.game_turns (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id text references public.users(id) on delete set null,
  player_name text not null,
  round_number integer not null,
  darts jsonb not null,
  score_delta integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.game_turns enable row level security;

create policy "Users can read game turns for own sessions"
  on public.game_turns for select
  using (
    game_session_id in (
      select id from public.game_sessions
      where created_by = auth.jwt() ->> 'sub'
    )
  );

create policy "Users can insert game turns for own sessions"
  on public.game_turns for insert
  with check (
    game_session_id in (
      select id from public.game_sessions
      where created_by = auth.jwt() ->> 'sub'
    )
  );

create index game_turns_session_id_idx
  on public.game_turns(game_session_id);
