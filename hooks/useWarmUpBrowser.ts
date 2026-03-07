import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

/**
 * Warms the Expo WebBrowser on mount and cools it down on unmount.
 *
 * Calls `WebBrowser.warmUpAsync()` when the hook mounts and `WebBrowser.coolDownAsync()` in the cleanup.
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}
