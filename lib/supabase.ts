import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in environment variables',
  );
}

/**
 * A Supabase client using the project anon key with default (unauthenticated) RLS behavior.
 *
 * Use this only during app bootstrap before Clerk is ready.
 * For authenticated requests scoped to the signed-in user, use the client from `useSupabase()`.
 */
export const supabaseAnon = createClient(supabaseUrl, supabaseKey);

/**
 * Creates a Supabase client that uses Clerk-issued JWTs for authentication.
 *
 * Uses Supabase's official `accessToken` callback so that every request
 * (HTTP, Realtime, Storage) automatically receives a fresh Clerk JWT.
 *
 * @param getToken - A function (from Clerk's `useAuth`) that returns a fresh
 *   Supabase-scoped JWT. Called with `{ template: 'supabase' }`.
 * @returns A Supabase client authenticated with the Clerk session.
 */
export function createClerkSupabaseClient(
  getToken: (opts?: { template: string }) => Promise<string | null>,
) {
  return createClient(supabaseUrl, supabaseKey, {
    accessToken: async () => {
      const token = await getToken({ template: 'supabase' });
      return token ?? '';
    },
  });
}
