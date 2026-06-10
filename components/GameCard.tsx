import { View, Text } from 'react-native';
import { DS_COLORS } from '@/constants/colors';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import type { DartGame } from '@/constants/games';

/**
 * Renders a pressable card displaying a game's icon, name, description, player count, and difficulty.
 *
 * @param game - Game data used to populate the card (icon, name, description, playerCount, difficulty).
 * @param onPress - Callback invoked when the card is pressed.
 * @returns The rendered pressable card element for the provided game.
 */
export function GameCard({ game, onPress }: { game: DartGame; onPress: () => void }) {
  const Icon = game.icon;

  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      className="border border-ds-outline-variant rounded-xl p-4 bg-ds-surface active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${game.name} - ${game.description}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="w-10 h-10 rounded-lg bg-ds-surface-low items-center justify-center">
          <Icon size={20} color={DS_COLORS.onSurface} />
        </View>
        <View className="flex-1 flex-shrink">
          <Text className="text-lg font-barlow-semi text-ds-on-surface">{game.name}</Text>
          <Text className="text-sm font-barlow text-ds-on-surface-variant mt-0.5" numberOfLines={2}>
            {game.description}
          </Text>
          <View className="flex-row gap-2 mt-2">
            <View className="bg-ds-surface-low rounded-full px-2.5 py-0.5">
              <Text className="text-xs text-ds-on-surface-variant">{game.playerCount} players</Text>
            </View>
            <View className="bg-ds-surface-low rounded-full px-2.5 py-0.5">
              <Text className="text-xs text-ds-on-surface-variant">{game.difficulty}</Text>
            </View>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
