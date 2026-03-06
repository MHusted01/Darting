import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';
import { ActivityIndicator, Text, View } from 'react-native';

const queryClient = new QueryClient();

const tokenCache = {
  async getToken(key: string) { return SecureStore.getItemAsync(key); },
  async saveToken(key: string, value: string) { return SecureStore.setItemAsync(key, value); },
};

const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

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

  // If no Clerk key, render without auth (for initial testing)
  if (!clerkKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
