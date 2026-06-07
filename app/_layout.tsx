import * as Sentry from '@sentry/react-native';
import { ClerkProvider, ClerkLoaded } from '@clerk/expo';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';
import { SupabaseProvider } from '@/providers/SupabaseProvider';
import { SyncRetryOnMount } from '@/components/SyncRetryOnMount';
import { Text, View } from 'react-native';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import {
  Barlow_400Regular,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import '../global.css';

SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

const tokenCache = {
  async getToken(key: string) { return SecureStore.getItemAsync(key); },
  async saveToken(key: string, value: string) { return SecureStore.setItemAsync(key, value); },
};

const CLERK_PUBLISHABLE_KEY = (() => {
  const value = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables');
  }
  return value;
})();

const CLERK_TASK_URLS = {
  'choose-organization': '/(protected)/(tabs)',
  'reset-password': '/(public)/reset-password',
  'setup-mfa': '/(public)/sign-in',
} as const;

/**
 * App root layout that performs database migrations and provides authentication and query contexts.
 *
 * Renders a centered error message if migrations fail, a full-screen loading indicator while migrations are in progress, or the application wrapped with ClerkProvider, ClerkLoaded, SupabaseProvider (which includes QueryClientProvider), and the navigation Stack after migrations succeed.
 *
 * @returns The root React element for the app layout described above.
 */
function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [fontsLoaded, fontsError] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    Barlow_400Regular,
    Barlow_600SemiBold,
    Barlow_700Bold,
  });

  const appReady = (success || !!error) && (fontsLoaded || !!fontsError);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Something went wrong. Please restart the app.</Text>
      </View>
    );
  }

  if (!appReady) {
    return null;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
      taskUrls={CLERK_TASK_URLS}
    >
      <ClerkLoaded>
        <SupabaseProvider>
          <SyncRetryOnMount />
          <Stack screenOptions={{ headerShown: false }} />
        </SupabaseProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

export default Sentry.wrap(RootLayout);
