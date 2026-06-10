import { Text, View } from 'react-native';
import { DS_COLORS } from '@/constants/colors';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { Trophy, Users } from 'lucide-react-native';
import type { Tournament, TournamentFormat, TournamentStatus } from '@/types/tournament';

const FORMAT_LABEL: Record<TournamentFormat, string> = {
  league: 'League',
  cup: 'Knockout',
  weekly: 'Weekly',
  round_robin: 'Round Robin',
};

const STATUS_STYLE: Record<TournamentStatus, { bg: string; text: string; label: string }> = {
  draft:     { bg: 'bg-ds-surface-container', text: 'text-ds-on-surface-variant', label: 'Draft' },
  active:    { bg: 'bg-ds-green',             text: 'text-ds-green-dark',         label: 'Active' },
  completed: { bg: 'bg-ds-surface-low',       text: 'text-ds-outline',            label: 'Completed' },
  cancelled: { bg: 'bg-ds-red-container',     text: 'text-ds-red',               label: 'Cancelled' },
};

interface TournamentCardProps {
  tournament: Tournament;
  onPress: () => void;
}

export function TournamentCard({ tournament, onPress }: TournamentCardProps) {
  const status = STATUS_STYLE[tournament.status];
  return (
    <AnimatedPressable
      haptic="light"
      onPress={onPress}
      className="bg-ds-surface border border-ds-outline-variant rounded-xl p-4 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${tournament.name} tournament`}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3 flex-row items-center gap-2">
          <Trophy size={16} color={DS_COLORS.onSurface} />
          <Text className="text-base font-barlow-semi text-ds-on-surface flex-1" numberOfLines={1}>
            {tournament.name}
          </Text>
        </View>
        <View className={`rounded-full px-2 py-0.5 ${status.bg}`}>
          <Text className={`text-xs font-barlow-semi ${status.text}`}>{status.label}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-4">
        <Text className="text-sm font-barlow text-ds-on-surface-variant">
          {FORMAT_LABEL[tournament.format]} • {tournament.gameSlug.toUpperCase()}
        </Text>
        <View className="flex-row items-center gap-1">
          <Users size={12} color={DS_COLORS.outline} />
          <Text className="text-sm font-barlow text-ds-outline">{tournament.participantCount}</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}
