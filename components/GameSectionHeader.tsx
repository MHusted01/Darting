import { View, Text } from 'react-native';

export function GameSectionHeader({ title }: { title: string }) {
  return (
    <View className="pt-6 pb-2">
      <Text className="text-xl font-bold text-black">{title}</Text>
    </View>
  );
}
