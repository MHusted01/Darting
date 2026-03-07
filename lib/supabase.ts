import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in environment variables',
  );
}

/**
 * A bare Supabase client with no auth headers.
 *
 * Use this only during app bootstrap (before Clerk is ready).
 * For authenticated requests, use the client from `useSupabase()`.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Creates a Supabase client that injects a Clerk-issued JWT on every request.
 *
 * @param getToken - A function (from Clerk's `useAuth`) that returns a fresh
 *   Supabase-scoped JWT. Pass `{ template: 'supabase' }` when calling it.
 * @returns A Supabase client whose requests include the Clerk JWT as the
 *   bearer token, falling back to the anon key when no token is available.
 */
export function createClerkSupabaseClient(
  getToken: (opts?: { template: string }) => Promise<string | null>,
) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        const token = await getToken({ template: 'supabase' });

        const headers = new Headers(options.headers);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        return fetch(url, { ...options, headers });
      },
    },
  });
}
