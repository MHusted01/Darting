import { ScrollView, Text, View } from 'react-native';
import { TournamentMatchCard } from '@/components/tournament/TournamentMatchCard';
import type { TournamentMatch, TournamentRound } from '@/types/tournament';

interface BracketViewProps {
  rounds: TournamentRound[];
  participantCount: number;
  currentUserId: string | null | undefined;
  onPlayMatch?: (match: TournamentMatch) => void;
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Round 1',
  2: 'Round 2',
  3: 'Quarter-Finals',
  4: 'Semi-Finals',
  5: 'Final',
};

function roundName(round: TournamentRound, totalRounds: number): string {
  const fromEnd = totalRounds - round.roundNumber + 1;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semi-Finals';
  if (fromEnd === 3) return 'Quarter-Finals';
  return ROUND_NAMES[round.roundNumber] ?? `Round ${round.roundNumber}`;
}

export function BracketView({ rounds, participantCount, currentUserId, onPlayMatch }: BracketViewProps) {
  const totalRounds = participantCount > 1 ? Math.ceil(Math.log2(participantCount)) : 1;

  if (rounds.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-sm font-barlow text-ds-outline">No rounds yet. Start the tournament to generate the bracket.</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
      {rounds.map(round => (
        <View key={round.id} style={{ width: 220 }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest">
              {roundName(round, totalRounds)}
            </Text>
            {round.status === 'completed' && (
              <View className="bg-ds-green rounded-full px-2 py-0.5">
                <Text className="text-xs font-barlow-semi text-ds-green-dark">Done</Text>
              </View>
            )}
          </View>
          <View className="gap-3">
            {round.matches.map(match => (
              <TournamentMatchCard
                key={match.id}
                match={match}
                currentUserId={currentUserId}
                onPlayPress={onPlayMatch}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
