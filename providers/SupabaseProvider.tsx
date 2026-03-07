import { useAuth } from '@clerk/clerk-expo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useMemo } from 'react';
import { createClerkSupabaseClient } from '@/lib/supabase';

type SupabaseContextValue = {
  supabase: SupabaseClient;
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

/**
 * Provides a Supabase client authenticated with the current Clerk session.
 *
 * Creates a single Supabase client (stable across re-renders) whose requests
 * automatically include a fresh Clerk-issued JWT via a custom fetch wrapper.
 * The client is recreated only when the Clerk user ID changes (sign-in / sign-out).
 *
 * Must be rendered inside `<ClerkProvider>` / `<ClerkLoaded>`.
 *
 * @returns A context provider wrapping its children with the authenticated Supabase client.
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();

  // Recreate the client when the user changes (sign-in / sign-out)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [userId]);

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

/**
 * Returns the Clerk-authenticated Supabase client from the nearest SupabaseProvider.
 *
 * @throws If called outside of a `<SupabaseProvider>`.
 * @returns The authenticated Supabase client instance.
 */
export function useSupabase(): SupabaseClient {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a <SupabaseProvider>');
  }
  return context.supabase;
}
