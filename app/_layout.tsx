import { ClerkProvider, ClerkLoaded } from '@clerk/expo';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';
import { SupabaseProvider } from '@/providers/SupabaseProvider';
import { ActivityIndicator, Text, View } from 'react-native';
import '../global.css';

const tokenCache = {
  async getToken(key: string) { return SecureStore.getItemAsync(key); },
  async saveToken(key: string, value: string) { return SecureStore.setItemAsync(key, value); },
};

function getClerkPublishableKey(): string {
  const value = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables');
  }
  return value;
}

/**
 * App root layout that performs database migrations and provides authentication and query contexts.
 *
 * Renders a centered error message if migrations fail, a full-screen loading indicator while migrations are in progress, or the application wrapped with ClerkProvider, ClerkLoaded, SupabaseProvider (which includes QueryClientProvider), and the navigation Stack after migrations succeed.
 *
 * @returns The root React element for the app layout described above.
 */
export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={getClerkPublishableKey()} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SupabaseProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SupabaseProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
