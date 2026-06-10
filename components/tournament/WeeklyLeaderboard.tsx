import { Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import type { TournamentParticipant, TournamentMatch } from '@/types/tournament';

interface WeeklyEntry {
  participant: TournamentParticipant;
  matchesPlayed: number;
  wins: number;
}

interface WeeklyLeaderboardProps {
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
}

function playerName(p: TournamentParticipant): string {
  const u = p.user;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Unknown';
}

export function WeeklyLeaderboard({ participants, matches }: WeeklyLeaderboardProps) {
  const winMap = new Map<string, number>();
  for (const p of participants) winMap.set(p.id, 0);

  for (const m of matches) {
    if (m.status === 'completed' && m.winner) {
      winMap.set(m.winner.id, (winMap.get(m.winner.id) ?? 0) + 1);
    }
  }

  const entries: WeeklyEntry[] = participants
    .map(p => ({
      participant: p,
      matchesPlayed: matches.filter(
        m => m.status === 'completed' && (m.participant1?.id === p.id || m.participant2?.id === p.id),
      ).length,
      wins: winMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.wins - a.wins);

  if (entries.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-sm font-barlow text-ds-outline">No participants yet</Text>
      </View>
    );
  }

  return (
    <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
      {entries.map((entry, idx) => (
        <View
          key={entry.participant.id}
          className={`flex-row items-center px-4 py-3 ${idx < entries.length - 1 ? 'border-b border-ds-outline-variant' : ''}`}
        >
          <View className="w-7 items-center">
            {idx === 0 ? (
              <Trophy size={14} color="#ba1a1a" />
            ) : (
              <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">{idx + 1}</Text>
            )}
          </View>
          <Text className="flex-1 text-sm font-barlow text-ds-on-surface" numberOfLines={1}>
            {playerName(entry.participant)}
          </Text>
          <Text className="text-sm font-barlow text-ds-on-surface-variant mr-3">
            {entry.matchesPlayed}P
          </Text>
          <Text className="text-sm font-barlow-bold text-ds-on-surface">{entry.wins}W</Text>
        </View>
      ))}
    </View>
  );
}
