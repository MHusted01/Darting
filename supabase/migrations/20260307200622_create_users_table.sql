-- Users table synced from Clerk via webhook
create table public.users (
  id text primary key,               
  email text unique not null,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Users can read their own row
create policy "Users can read own data"
  on public.users
  for select
  using (id = auth.jwt() ->> 'sub');

-- Users can update their own row
create policy "Users can update own data"
  on public.users
  for update
  using (id = auth.jwt() ->> 'sub');

-- Only the webhook (service role) can insert/delete
-- No insert/delete policies for authenticated users

-- Auto-update updated_at on row changes
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.users
  for each row
  execute function public.handle_updated_at();
