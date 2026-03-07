import { Stack } from 'expo-router';

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
