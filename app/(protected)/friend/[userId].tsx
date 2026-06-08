import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/providers/SupabaseProvider';

interface PublicPlayerStats {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  games_played: number;
  avg_three_dart_avg: number | null;
  win_rate: number | null;
  per_game_kpis: Record<string, number | null> | null;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-ds-surface border border-ds-outline-variant rounded-xl p-4 flex-1 items-center">
      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
        {label}
      </Text>
      <Text className="text-2xl font-barlow-bold text-ds-on-surface">{value}</Text>
    </View>
  );
}

export default function FriendProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const supabase = useSupabase();

  const { data, isLoading, isError } = useQuery<PublicPlayerStats | null>({
    queryKey: ['friend-stats', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_player_public_stats', {
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      const rows = data as PublicPlayerStats[] | null;
      return rows?.[0] ?? null;
    },
    enabled: !!userId,
  });

  const displayName = data
    ? [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || 'Player'
    : '—';

  const initials = data
    ? [data.first_name?.[0], data.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
    : '?';

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="active:opacity-70"
        >
          <ArrowLeft size={22} color="#1c1b1b" />
        </Pressable>
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Profile</Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ba1a1a" />
        </View>
      )}

      {isError && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm font-barlow text-ds-outline text-center">
            Could not load this player&apos;s stats.
          </Text>
        </View>
      )}

      {!isLoading && !isError && data === null && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm font-barlow text-ds-outline text-center">
            Stats not available.
          </Text>
        </View>
      )}

      {!isLoading && !isError && data && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="px-6">
            {/* Avatar + name */}
            <View className="items-center pt-8 pb-6">
              <View className="w-20 h-20 rounded-full bg-ds-surface-low items-center justify-center mb-3">
                <Text className="text-2xl font-barlow-semi text-ds-on-surface-variant">
                  {initials}
                </Text>
              </View>
              <Text className="text-2xl font-barlow-condensed text-ds-on-surface">
                {displayName}
              </Text>
              {data.username && (
                <Text className="text-sm font-barlow text-ds-outline mt-1">@{data.username}</Text>
              )}
            </View>

            {/* Headline stats */}
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
              Stats
            </Text>
            <View className="flex-row gap-3 mb-6">
              <StatCard
                label="Games"
                value={String(data.games_played ?? 0)}
              />
              <StatCard
                label="3-Dart Avg"
                value={data.avg_three_dart_avg != null ? data.avg_three_dart_avg.toFixed(1) : '—'}
              />
              <StatCard
                label="Win Rate"
                value={
                  data.win_rate != null
                    ? `${Math.round(data.win_rate * 100)}%`
                    : '—'
                }
              />
            </View>

            {/* Per-game averages */}
            {data.per_game_kpis && Object.keys(data.per_game_kpis).length > 0 && (
              <>
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
                  By Game
                </Text>
                <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
                  {Object.entries(data.per_game_kpis).map(([slug, avg], index, arr) => (
                    <View
                      key={slug}
                      className={`px-4 py-3 flex-row items-center justify-between ${
                        index < arr.length - 1 ? 'border-b border-ds-outline-variant' : ''
                      }`}
                    >
                      <Text className="text-sm font-barlow text-ds-on-surface capitalize">
                        {slug.replace(/-/g, ' ')}
                      </Text>
                      <Text className="text-sm font-barlow-semi text-ds-on-surface">
                        {avg != null ? Number(avg).toFixed(1) : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
