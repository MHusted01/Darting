import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

/**
 * Renders the Settings screen with a "Sign Out" action.
 *
 * Pressing "Sign Out" signs the current user out and navigates to the public sign-in route; if sign-out fails an alert with the error message is shown.
 *
 * @returns The Settings screen React element.
 */
export default function Settings() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/(public)/sign-in');
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message ?? 'Something went wrong');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6">
      <Text className="text-3xl font-bold text-center mb-8">Settings</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSigningOut ? 'Signing out' : 'Sign out'}
        accessibilityState={{ disabled: isSigningOut }}
        className={`border border-red-500 rounded-lg p-4 items-center active:opacity-70 ${isSigningOut ? 'opacity-50' : ''}`}
        onPress={handleSignOut}
        disabled={isSigningOut}
      >
        <Text className="text-red-500 text-base font-semibold">
          {isSigningOut ? 'Signing Out...' : 'Sign Out'}
        </Text>
      </Pressable>
    </View>
  );
}
