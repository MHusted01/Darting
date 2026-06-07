-- Tighten RLS policies identified in code review.

-- 1. Friendships UPDATE: add WITH CHECK to prevent row retargeting
--    (previously only had USING, which let attackers change addressee_id via raw API)
alter policy "Addressee can accept or decline"
  on public.friendships
  using (addressee_id = auth.jwt() ->> 'sub')
  with check (addressee_id = auth.jwt() ->> 'sub');

-- 2. Club invites UPDATE: same fix
alter policy "Invitee can update invite status"
  on public.club_invites
  using (invitee_id = auth.jwt() ->> 'sub')
  with check (invitee_id = auth.jwt() ->> 'sub');

-- 3. Clubs SELECT: restrict to authenticated users (was using (true) = anon access)
alter policy "Clubs are publicly searchable"
  on public.clubs
  using (auth.role() = 'authenticated');

-- 4. Club memberships SELECT: same
alter policy "Memberships are publicly visible"
  on public.club_memberships
  using (auth.role() = 'authenticated');
