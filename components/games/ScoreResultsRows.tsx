import { View, Text } from 'react-native';
import { Trophy } from 'lucide-react-native';
import type { ScorePlayerResult } from '@/lib/games/results';

interface ScoreResultsRowsProps {
  players: ScorePlayerResult[];
  scoreLabel?: string; // e.g. "pts", "runs"
}

export function ScoreResultsRows({
  players,
  scoreLabel = 'pts',
}: ScoreResultsRowsProps) {
  return (
    <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
      {players.map((player, idx) => (
        <View
          key={player.playerId}
          className={`px-4 py-4 flex-row items-center gap-3${idx < players.length - 1 ? ' border-b border-ds-outline-variant' : ''}`}
        >
          <Text className="text-sm font-barlow-semi text-ds-on-surface-variant w-5">
            {idx + 1}
          </Text>
          <View
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: player.avatarColor }}
          >
            <Text className="text-xs font-barlow-semi text-white">
              {player.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-barlow text-ds-on-surface">{player.name}</Text>
            <Text className="text-xs font-barlow text-ds-on-surface-variant">
              {player.turns} turns · {player.totalDarts} darts
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-base font-barlow-semi text-ds-on-surface">
              {player.score} {scoreLabel}
            </Text>
            {player.isWinner && (
              <Trophy size={14} color="#f59e0b" style={{ marginTop: 2 }} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
