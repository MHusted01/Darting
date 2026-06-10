import { View, Text } from 'react-native';
import type { CricketPlayerResult } from '@/lib/games/results';

interface CricketResultsRowsProps {
  players: CricketPlayerResult[];
}

export function CricketResultsRows({ players }: CricketResultsRowsProps) {
  return (
    <>
      {players.map((result, index) => {
        const markingRate =
          result.totalDarts > 0
            ? Math.round((result.totalMarks / (result.totalDarts * 3)) * 100)
            : 0;

        return (
          <View
            key={result.name + index}
            className={`flex-row items-center py-4 px-4 rounded-xl mb-2 ${
              result.isWinner ? 'bg-ds-surface-container border border-ds-outline-variant' : 'bg-ds-surface-low'
            }`}
          >
            <Text className="text-lg font-barlow-semi text-ds-outline w-8">
              {index + 1}
            </Text>
            <View
              className="w-8 h-8 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: result.avatarColor }}
            >
              <Text className="text-ds-on-red text-sm font-barlow-bold">
                {result.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-barlow-semi text-ds-on-surface">{result.name}</Text>
              <Text className="text-sm text-ds-on-surface-variant">
                {result.totalDarts} darts • {result.segmentsClosed}/7 closed •{' '}
                {markingRate}% marking rate
              </Text>
            </View>
            <Text
              className={`text-base font-barlow-bold ${
                result.isWinner ? 'text-ds-on-surface' : 'text-ds-on-surface-variant'
              }`}
            >
              {result.points} pts
            </Text>
          </View>
        );
      })}
    </>
  );
}
