-- Add dedup column (nullable first to allow safe backfill before constraint)
alter table public.game_sessions
  add column if not exists source_session_id text;

-- Backfill existing rows using their cloud UUID as surrogate dedup key
update public.game_sessions
  set source_session_id = id::text
  where source_session_id is null;

-- Enforce NOT NULL now that all rows are backfilled — prevents NULLs from bypassing the unique constraint
alter table public.game_sessions
  alter column source_session_id set not null;

-- Unique constraint — upsert onConflict targets (created_by, source_session_id)
alter table public.game_sessions
  add constraint game_sessions_created_by_source_unique
  unique (created_by, source_session_id);

-- UPDATE policy for game_sessions — upsert ON CONFLICT DO UPDATE requires UPDATE permission
create policy "Users can update own game sessions"
  on public.game_sessions for update
  using (created_by = auth.jwt() ->> 'sub')
  with check (created_by = auth.jwt() ->> 'sub');

-- UPDATE policy for game_players — upsert ON CONFLICT DO UPDATE requires UPDATE permission
create policy "Users can update game players for own sessions"
  on public.game_players for update
  using (
    game_session_id in (
      select id from public.game_sessions where created_by = auth.jwt() ->> 'sub'
    )
  )
  with check (
    game_session_id in (
      select id from public.game_sessions where created_by = auth.jwt() ->> 'sub'
    )
  );

-- DELETE policy for game_turns — retry pattern deletes all turns then re-inserts fresh
create policy "Users can delete game turns for own sessions"
  on public.game_turns for delete
  using (
    game_session_id in (
      select id from public.game_sessions where created_by = auth.jwt() ->> 'sub'
    )
  );
