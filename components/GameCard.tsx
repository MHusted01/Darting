import { View, Text, Pressable } from 'react-native';
import type { DartGame } from '@/constants/games';

export function GameCard({ game, onPress }: { game: DartGame; onPress: () => void }) {
  const Icon = game.icon;

  return (
    <Pressable
      onPress={onPress}
      className="border border-gray-200 rounded-xl p-4 bg-white active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`${game.name} - ${game.description}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center">
          <Icon size={20} color="black" />
        </View>
        <View className="flex-1 flex-shrink">
          <Text className="text-lg font-semibold text-black">{game.name}</Text>
          <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>
            {game.description}
          </Text>
          <View className="flex-row gap-2 mt-2">
            <View className="bg-gray-100 rounded-full px-2.5 py-0.5">
              <Text className="text-xs text-gray-600">{game.playerCount} players</Text>
            </View>
            <View className="bg-gray-100 rounded-full px-2.5 py-0.5">
              <Text className="text-xs text-gray-600">{game.difficulty}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
