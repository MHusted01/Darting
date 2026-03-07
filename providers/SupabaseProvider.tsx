import { useAuth } from '@clerk/clerk-expo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import { createClerkSupabaseClient } from '@/lib/supabase';

type SupabaseContextValue = {
  supabase: SupabaseClient;
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

/**
 * Provides a Clerk-authenticated Supabase client and a user-scoped QueryClient.
 *
 * Both the Supabase client and the QueryClient are recreated when the Clerk
 * user ID changes (sign-in / sign-out), preventing cached data from leaking
 * between users.
 *
 * Must be rendered inside `<ClerkProvider>` / `<ClerkLoaded>`.
 *
 * @returns A context provider wrapping its children with the authenticated
 *   Supabase client and a fresh QueryClient scoped to the current user.
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();

  // Recreate both clients when the user changes (sign-in / sign-out)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [userId]);
  const queryClient = useMemo(() => new QueryClient(), [userId]);

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
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
