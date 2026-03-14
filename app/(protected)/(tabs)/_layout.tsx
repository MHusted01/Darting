import { Tabs } from 'expo-router';
import { House, History, Settings } from 'lucide-react-native';

/**
 * Render the bottom tab navigator with Home, History, and Settings tabs.
 *
 * The navigator hides screen headers and configures active and inactive tab tint colors.
 *
 * @returns The Tabs navigator React element containing the "index" (Home), "history" (History), and "settings" (Settings) screens
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: 'black',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
