import { createContext, useContext } from 'react';
import { usePresence } from '@/hooks/usePresence';
import type { FriendStatus, PresenceMap } from '@/types/social';

type PresenceContextValue = {
  presenceMap: PresenceMap;
  setStatus: (status: FriendStatus) => Promise<void>;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const value = usePresence();
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresenceContext(): PresenceContextValue {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresenceContext must be used within a <PresenceProvider>');
  }
  return context;
}
