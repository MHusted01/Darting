import { View, Text } from 'react-native';

/**
 * Renders a section header showing the provided title in bold, extra-large, black text within a padded container.
 *
 * @param title - The header text to display.
 * @returns A React element containing the formatted header.
 */
export function GameSectionHeader({ title }: { title: string }) {
  return (
    <View className="pt-6 pb-2">
      <Text className="text-xl font-bold text-black">{title}</Text>
    </View>
  );
}
