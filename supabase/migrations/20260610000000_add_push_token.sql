ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token text;

-- Allow each authenticated user to update only their own push_token.
-- Column-level grant restricts which columns they can set; the RLS policy
-- restricts which rows they can touch. Service-role keeps sole rights over
-- all other profile fields (email, first_name, etc.) via the existing absence
-- of any other UPDATE policy.
CREATE POLICY "Users can update own push_token"
  ON public.users
  FOR UPDATE
  USING (id = auth.jwt() ->> 'sub')
  WITH CHECK (id = auth.jwt() ->> 'sub');

GRANT UPDATE (push_token) ON public.users TO authenticated;
