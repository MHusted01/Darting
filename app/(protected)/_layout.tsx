import { RedirectToTasks, useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { usePushToken } from '@/hooks/usePushToken';
import { useNotificationRouting } from '@/hooks/useNotificationRouting';

export default function ProtectedLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  usePushToken();
  useNotificationRouting();

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return <Redirect href="/(public)/sign-in" />;
  }

  return (
    <>
      <RedirectToTasks />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
