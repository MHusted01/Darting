import { View, Text } from 'react-native';
import type { ATCPlayerResult } from '@/lib/games/results';

interface ATCResultsRowsProps {
  players: ATCPlayerResult[];
}

export function ATCResultsRows({ players }: ATCResultsRowsProps) {
  return (
    <>
      {players.map((result, index) => (
        <View
          key={result.name + index}
          className={`flex-row items-center py-4 px-4 rounded-xl mb-2 ${
            result.isWinner ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
          }`}
        >
          <Text className="text-lg font-bold text-gray-400 w-8">
            {index + 1}
          </Text>
          <View
            className="w-8 h-8 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: result.avatarColor }}
          >
            <Text className="text-white text-sm font-bold">
              {result.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-black">{result.name}</Text>
            <Text className="text-sm text-gray-500">
              {result.totalDarts} darts •{' '}
              {result.totalDarts > 0
                ? Math.round((result.hits / result.totalDarts) * 100)
                : 0}
              % hit rate
            </Text>
          </View>
          <Text
            className={`text-base font-bold ${
              result.isWinner ? 'text-amber-600' : 'text-gray-600'
            }`}
          >
            {result.targetsHit}/{result.maxTarget}
          </Text>
        </View>
      ))}
    </>
  );
}
