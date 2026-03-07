import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Warms the Expo WebBrowser on mount and cools it down on unmount.
 *
 * Calls `WebBrowser.warmUpAsync()` when the hook mounts and `WebBrowser.coolDownAsync()` in the cleanup.
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}
