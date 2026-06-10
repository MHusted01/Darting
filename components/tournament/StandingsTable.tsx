import { Text, View } from 'react-native';
import type { LeagueStandingRow } from '@/types/tournament';

function playerName(row: LeagueStandingRow): string {
  const u = row.participant.user;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Unknown';
}

interface StandingsTableProps {
  standings: LeagueStandingRow[];
}

export function StandingsTable({ standings }: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-sm font-barlow text-ds-outline">No results yet</Text>
      </View>
    );
  }

  return (
    <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
      <View className="flex-row px-4 py-2 bg-ds-surface-container border-b border-ds-outline-variant">
        <Text className="w-7 text-xs font-barlow-semi text-ds-on-surface-variant">#</Text>
        <Text className="flex-1 text-xs font-barlow-semi text-ds-on-surface-variant">Player</Text>
        <Text className="w-7 text-xs font-barlow-semi text-ds-on-surface-variant text-center">P</Text>
        <Text className="w-7 text-xs font-barlow-semi text-ds-on-surface-variant text-center">W</Text>
        <Text className="w-7 text-xs font-barlow-semi text-ds-on-surface-variant text-center">D</Text>
        <Text className="w-7 text-xs font-barlow-semi text-ds-on-surface-variant text-center">L</Text>
        <Text className="w-8 text-xs font-barlow-semi text-ds-on-surface text-right">Pts</Text>
      </View>
      {standings.map((row, idx) => (
        <View
          key={row.participant.id}
          className={`flex-row items-center px-4 py-3 ${idx < standings.length - 1 ? 'border-b border-ds-outline-variant' : ''}`}
        >
          <Text className="w-7 text-sm font-barlow-semi text-ds-on-surface-variant">{idx + 1}</Text>
          <Text className="flex-1 text-sm font-barlow text-ds-on-surface" numberOfLines={1}>
            {playerName(row)}
          </Text>
          <Text className="w-7 text-sm font-barlow text-ds-on-surface-variant text-center">{row.played}</Text>
          <Text className="w-7 text-sm font-barlow text-ds-on-surface-variant text-center">{row.won}</Text>
          <Text className="w-7 text-sm font-barlow text-ds-on-surface-variant text-center">{row.drawn}</Text>
          <Text className="w-7 text-sm font-barlow text-ds-on-surface-variant text-center">{row.lost}</Text>
          <Text className="w-8 text-sm font-barlow-bold text-ds-on-surface text-right">{row.points}</Text>
        </View>
      ))}
    </View>
  );
}
