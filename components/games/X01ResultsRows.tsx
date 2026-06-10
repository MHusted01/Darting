import { View, Text } from 'react-native';
import type { X01PlayerResult } from '@/lib/games/results';

interface X01ResultsRowsProps {
  players: X01PlayerResult[];
}

export function X01ResultsRows({ players }: X01ResultsRowsProps) {
  return (
    <View className="border border-ds-outline-variant rounded-xl overflow-hidden">
      {players.map((player, index) => (
        <View
          key={player.name + index}
          className={`flex-row items-center px-4 py-4 ${
            index < players.length - 1 ? 'border-b border-ds-outline-variant' : ''
          } ${player.isWinner ? 'bg-ds-surface-container' : 'bg-ds-surface'}`}
        >
          <Text className="w-7 text-sm font-barlow-semi text-ds-on-surface-variant">
            {index + 1}.
          </Text>
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: player.avatarColor }}
          >
            <Text className="text-ds-on-red text-xs font-barlow-semi">
              {player.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="flex-1">
            <Text className="text-base font-barlow-semi text-ds-on-surface">
              {player.name}
            </Text>
            <Text className="text-xs font-barlow text-ds-on-surface-variant mt-0.5">
              {player.dartsThrown} darts
              {player.threeDartAvg > 0
                ? ` · ${player.threeDartAvg.toFixed(1)} avg`
                : ''}
            </Text>
          </View>

          <View className="items-end">
            <Text className="text-lg font-barlow-bold text-ds-on-surface">
              {player.finalScore}
            </Text>
            <Text className="text-xs font-barlow text-ds-on-surface-variant">
              remaining
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
