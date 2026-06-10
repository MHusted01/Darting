import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Eye } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useChallengeChannel } from '@/hooks/useChallengeChannel';
import { getChallenge } from '@/lib/realtime-api';
import type { TurnBroadcastPayload } from '@/lib/realtime-game';
import { GAMES } from '@/constants/games';
import type { GameChallenge } from '@/types/realtime';

interface TurnFeedEntry {
  turnSeq: number;
  userId: string;
  scoreLine: string;
}

function dartLabel(segment: number, multiplier: number): string {
  if (multiplier === 0 || segment === 0) return 'Miss';
  const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : '';
  return `${prefix}${segment === 25 ? 'Bull' : segment}`;
}

export default function ChallengeSpectatorScreen() {
  const router = useRouter();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const supabase = useSupabase();

  const [scores, setScores] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<TurnFeedEntry[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  const { data: challenge, isLoading } = useQuery<GameChallenge>({
    queryKey: ['challenge', challengeId],
    queryFn: () => getChallenge(supabase, challengeId!),
    enabled: Boolean(challengeId),
  });

  const handleTurn = useCallback((payload: TurnBroadcastPayload) => {
    setScores(payload.scores);
    setFeed((prev) =>
      [
        {
          turnSeq: payload.turnSeq,
          userId: payload.userId,
          scoreLine: payload.darts.map((d) => dartLabel(d.segment, d.multiplier)).join('  '),
        },
        ...prev,
      ].slice(0, 20),
    );
  }, []);

  const handleChallengeUpdate = useCallback((update: { status: string }) => {
    setLiveStatus(update.status);
  }, []);

  useChallengeChannel({
    challengeId: challengeId ?? null,
    mode: 'spectator',
    onTurn: handleTurn,
    onChallengeUpdate: handleChallengeUpdate,
  });

  const status = liveStatus ?? challenge?.status ?? null;
  const game = challenge ? GAMES.find((g) => g.slug === challenge.gameSlug) : undefined;

  const nameFor = (userId: string): string => {
    if (!challenge) return 'Player';
    if (userId === challenge.challengerId) return challenge.challengerName;
    if (userId === challenge.challengeeId) return challenge.challengeeName;
    return 'Player';
  };

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
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Watching Live</Text>
        <View className="ml-auto flex-row items-center gap-1">
          <Eye size={18} color="#747878" />
        </View>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ba1a1a" />
        </View>
      )}

      {!isLoading && !challenge && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm font-barlow text-ds-outline text-center">
            This match is not available.
          </Text>
        </View>
      )}

      {challenge && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="px-6 pt-6">
            <View className="items-center mb-6">
              <Text className="text-2xl font-barlow-condensed text-ds-on-surface">
                {game?.name ?? challenge.gameSlug}
              </Text>
              {status === 'in_progress' ? (
                <View className="flex-row items-center gap-2 mt-1">
                  <View className="w-2 h-2 rounded-full bg-ds-red" />
                  <Text className="text-sm font-barlow-semi text-ds-red">LIVE</Text>
                </View>
              ) : (
                <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1 capitalize">
                  {status?.replace(/_/g, ' ') ?? ''}
                </Text>
              )}
            </View>

            <View className="flex-row gap-3 mb-6">
              {[
                { id: challenge.challengerId, name: challenge.challengerName },
                { id: challenge.challengeeId, name: challenge.challengeeName },
              ].map((player) => (
                <View
                  key={player.id}
                  className="bg-ds-surface border border-ds-outline-variant rounded-xl p-4 flex-1 items-center"
                >
                  <Text
                    className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1"
                    numberOfLines={1}
                  >
                    {player.name}
                  </Text>
                  <Text className="text-3xl font-barlow-bold text-ds-on-surface">
                    {scores[player.id] ?? '—'}
                  </Text>
                </View>
              ))}
            </View>

            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Turn Feed
            </Text>
            {feed.length === 0 ? (
              <Text className="text-sm font-barlow text-ds-outline">
                Waiting for the next turn…
              </Text>
            ) : (
              <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
                {feed.map((entry, index) => (
                  <View
                    key={entry.turnSeq}
                    className={`px-4 py-3 flex-row items-center justify-between ${
                      index < feed.length - 1 ? 'border-b border-ds-outline-variant' : ''
                    }`}
                  >
                    <Text className="text-sm font-barlow-semi text-ds-on-surface">
                      {nameFor(entry.userId)}
                    </Text>
                    <Text className="text-sm font-barlow text-ds-on-surface-variant">
                      {entry.scoreLine}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
