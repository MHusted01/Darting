import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/providers/SupabaseProvider';
import { getLiveClubChallenges } from '@/lib/realtime-api';
import { useFeatureGate } from '@/lib/subscription';
import { GAMES } from '@/constants/games';

export function LiveChallengesSection({ clubId }: { clubId: string }) {
  const router = useRouter();
  const supabase = useSupabase();
  const realtimeGamesEnabled = useFeatureGate('REALTIME_GAMES');

  const { data: liveChallenges } = useQuery({
    queryKey: ['live-challenges', clubId],
    queryFn: () => getLiveClubChallenges(supabase, clubId),
    enabled: realtimeGamesEnabled && Boolean(clubId),
    refetchInterval: 30_000,
  });

  if (!realtimeGamesEnabled || !liveChallenges || liveChallenges.length === 0) return null;

  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2">
        <View className="w-2 h-2 rounded-full bg-ds-red" />
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest">
          Live Now
        </Text>
      </View>
      <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
        {liveChallenges.map((challenge, index) => (
          <Pressable
            key={challenge.id}
            onPress={() => router.push(`/challenge/${challenge.id}/watch`)}
            accessibilityRole="button"
            accessibilityLabel={`Watch ${challenge.challengerName} vs ${challenge.challengeeName}`}
            className={`px-4 py-3 flex-row items-center justify-between active:opacity-70 ${
              index < liveChallenges.length - 1 ? 'border-b border-ds-outline-variant' : ''
            }`}
          >
            <View className="flex-1 mr-3">
              <Text className="text-sm font-barlow-semi text-ds-on-surface" numberOfLines={1}>
                {challenge.challengerName} vs {challenge.challengeeName}
              </Text>
              <Text className="text-xs font-barlow text-ds-on-surface-variant">
                {GAMES.find((g) => g.slug === challenge.gameSlug)?.name ?? challenge.gameSlug}
              </Text>
            </View>
            <Eye size={18} color="#747878" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
