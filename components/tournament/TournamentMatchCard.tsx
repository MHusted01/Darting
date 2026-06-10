import { Pressable, Text, View } from 'react-native';
import { DS_COLORS } from '@/constants/colors';
import { CheckCircle, Play } from 'lucide-react-native';
import type { TournamentMatch, TournamentParticipant } from '@/types/tournament';

function participantName(p: TournamentParticipant | null): string {
  if (!p) return 'TBD';
  const u = p.user;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Unknown';
}

interface TournamentMatchCardProps {
  match: TournamentMatch;
  currentUserId: string | null | undefined;
  onPlayPress?: (match: TournamentMatch) => void;
}

export function TournamentMatchCard({ match, currentUserId, onPlayPress }: TournamentMatchCardProps) {
  const isParticipant =
    match.participant1?.user.id === currentUserId ||
    match.participant2?.user.id === currentUserId;
  const canPlay = match.status === 'pending' && isParticipant && onPlayPress != null;
  const isWinner1 = match.winner?.id === match.participant1?.id;
  const isWinner2 = match.winner?.id === match.participant2?.id;

  if (match.status === 'bye') {
    return (
      <View className="bg-ds-surface-low border border-ds-outline-variant rounded-xl px-4 py-3">
        <Text className="text-sm font-barlow text-ds-outline text-center">
          {participantName(match.participant1)} — Bye (auto-advance)
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            {isWinner1 && <CheckCircle size={14} color={DS_COLORS.greenDark} />}
            <Text
              className={`text-sm font-barlow-semi ${match.status === 'completed' && isWinner1 ? 'text-ds-green-dark' : 'text-ds-on-surface'}`}
              numberOfLines={1}
            >
              {participantName(match.participant1)}
            </Text>
          </View>
          <Text className="text-xs font-barlow text-ds-outline">vs</Text>
          <View className="flex-row items-center gap-2 mt-1">
            {isWinner2 && <CheckCircle size={14} color={DS_COLORS.greenDark} />}
            <Text
              className={`text-sm font-barlow-semi ${match.status === 'completed' && isWinner2 ? 'text-ds-green-dark' : 'text-ds-on-surface'}`}
              numberOfLines={1}
            >
              {participantName(match.participant2)}
            </Text>
          </View>
        </View>

        {match.status === 'completed' ? (
          <View className="bg-ds-green rounded-lg px-2 py-1">
            <Text className="text-xs font-barlow-semi text-ds-green-dark">Done</Text>
          </View>
        ) : canPlay ? (
          <Pressable
            onPress={() => onPlayPress(match)}
            className="bg-ds-red rounded-lg px-3 py-2 flex-row items-center gap-1 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Play match"
          >
            <Play size={12} color={DS_COLORS.onRed} />
            <Text className="text-xs font-barlow-semi text-ds-on-red">Play</Text>
          </Pressable>
        ) : (
          <View className="bg-ds-surface-container rounded-lg px-2 py-1">
            <Text className="text-xs font-barlow text-ds-outline">Pending</Text>
          </View>
        )}
      </View>
    </View>
  );
}
