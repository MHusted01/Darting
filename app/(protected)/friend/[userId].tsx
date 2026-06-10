import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Swords } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useMutualClubs, usePlayerRecentGames, usePlayerStreak } from '@/hooks/useFriendSocial';
import { timeAgo } from '@/lib/time';
import { useFeatureGate } from '@/lib/subscription';
import { useCreateChallenge } from '@/hooks/useChallenges';
import { ChallengeSheet } from '@/components/ChallengeSheet';
import type { ChallengeSettings } from '@/lib/realtime-game';

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

  useEffect(() => {
    if (isError) Alert.alert('Error', "Could not load this player's stats.");
  }, [isError]);

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
                <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-6">
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

            <Phase8Sections userId={userId} displayName={displayName} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Phase8Sections({ userId, displayName }: { userId: string; displayName: string }) {
  const router = useRouter();
  const { streak, isLoading: streakLoading } = usePlayerStreak(userId);
  const { data: recentGames, isLoading: gamesLoading } = usePlayerRecentGames(userId);
  const { data: mutualClubs, isLoading: clubsLoading } = useMutualClubs(userId);
  const realtimeGamesEnabled = useFeatureGate('REALTIME_GAMES');
  const createChallenge = useCreateChallenge();
  const [sheetVisible, setSheetVisible] = useState(false);

  const handleSendChallenge = (gameSlug: string, settings: ChallengeSettings) => {
    createChallenge.mutate(
      { challengeeId: userId, gameSlug, settings },
      {
        onSuccess: (challengeId) => {
          setSheetVisible(false);
          router.push(`/challenge/${challengeId}`);
        },
        onError: () => {
          Alert.alert('Error', 'Could not send the challenge. Please try again.');
        },
      },
    );
  };

  return (
    <>
      {/* Streak */}
      {!streakLoading && streak > 0 && (
        <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-3 mb-6 flex-row items-center justify-between">
          <Text className="text-sm font-barlow-semi text-ds-on-surface">Current Streak</Text>
          <Text className="text-base font-barlow-bold text-ds-red">
            {streak} day{streak === 1 ? '' : 's'} 🔥
          </Text>
        </View>
      )}

      {/* Recent games */}
      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
        Recent Games
      </Text>
      {gamesLoading ? (
        <ActivityIndicator size="small" color="#ba1a1a" className="mb-6" />
      ) : !Array.isArray(recentGames) || recentGames.length === 0 ? (
        <Text className="text-sm font-barlow text-ds-outline mb-6">No recent games.</Text>
      ) : (
        <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-6">
          {recentGames.map((game, index) => (
            <View
              key={game.id}
              className={`px-4 py-3 flex-row items-center justify-between ${
                index < recentGames.length - 1 ? 'border-b border-ds-outline-variant' : ''
              }`}
            >
              <View>
                <Text className="text-sm font-barlow-semi text-ds-on-surface capitalize">
                  {game.gameSlug.replace(/-/g, ' ')}
                </Text>
                <Text className="text-xs font-barlow text-ds-outline">
                  {timeAgo(game.completedAt)}
                </Text>
              </View>
              <View className="items-end">
                {game.isWinner && (
                  <Text className="text-xs font-barlow-semi text-ds-green-dark">Won</Text>
                )}
                {game.threeDartAvg != null && (
                  <Text className="text-xs font-barlow text-ds-on-surface-variant">
                    {game.threeDartAvg.toFixed(1)} avg
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Mutual clubs */}
      {!clubsLoading && Array.isArray(mutualClubs) && mutualClubs.length > 0 && (
        <>
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
            Mutual Clubs
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {mutualClubs.map((club) => (
              <View
                key={club.id}
                className="bg-ds-surface-low border border-ds-outline-variant rounded-full px-3 py-1"
              >
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">{club.name}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Challenge CTA */}
      {realtimeGamesEnabled && (
        <>
          <Pressable
            onPress={() => setSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Challenge to a game"
            className="bg-ds-red rounded-xl py-4 items-center active:opacity-70 mb-6"
          >
            <View className="flex-row items-center gap-2">
              <Swords size={18} color="white" />
              <Text className="text-base font-barlow-semi text-white">Challenge to a game</Text>
            </View>
          </Pressable>
          <ChallengeSheet
            visible={sheetVisible}
            opponentName={displayName}
            onClose={() => setSheetVisible(false)}
            onSubmit={handleSendChallenge}
            isLoading={createChallenge.isPending}
          />
        </>
      )}
    </>
  );
}
