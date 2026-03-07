import { Stack } from 'expo-router';

/**
 * Layout component that provides the navigation stack for the protected game route.
 *
 * Renders an Expo Router `Stack` configured with `headerBackTitle` set to `"Games"`, an
 * empty `headerTitle`, and `headerShadowVisible` disabled.
 *
 * @returns The `Stack` element used as the game route layout.
 */
export default function GameLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Games',
        headerTitle: '',
        headerShadowVisible: false,
      }}
    />
  );
}
