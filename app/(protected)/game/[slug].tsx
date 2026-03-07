import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GAMES } from '@/constants/games';

export default function GameDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const game = GAMES.find((g) => g.slug === slug);

  if (!game) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-lg text-gray-500">Game not found</Text>
      </View>
    );
  }

  const Icon = game.icon;

  return (
    <View className="flex-1 justify-center items-center bg-white px-6">
      <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center mb-4">
        <Icon size={32} color="black" />
      </View>
      <Text className="text-2xl font-bold text-black mb-2">{game.name}</Text>
      <Text className="text-base text-gray-500 text-center mb-6">{game.description}</Text>
      <Text className="text-sm text-gray-400">Game setup coming soon</Text>
    </View>
  );
}
