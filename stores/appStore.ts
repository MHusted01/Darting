import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { storage } from '@/lib/storage';

// This adapter makes MMKV compatible with Zustand's persist API
const mmkvStorage: StateStorage = {
  setItem: (name, value) => storage.set(name, value),
  getItem: (name) => storage.getString(name) ?? null,
  removeItem: (name) => storage.remove(name),
};

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
    }),
    {
      name: 'app-store',            // key in MMKV
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
