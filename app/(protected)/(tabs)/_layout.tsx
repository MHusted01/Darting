import { Tabs } from 'expo-router';
import { House, Settings } from 'lucide-react-native';

/**
 * Render the bottom tab navigator with Home and Settings tabs.
 *
 * The navigator hides screen headers and applies active and inactive tint colors to tab icons. Each tab is represented by an icon: House for Home and Settings for Settings.
 *
 * @returns The Tabs navigator React element containing the "index" (Home) and "settings" screens.
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
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
