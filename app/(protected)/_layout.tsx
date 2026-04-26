import { RedirectToTasks, useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

export default function ProtectedLayout() {
  const { isSignedIn, isLoaded } = useAuth();

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
