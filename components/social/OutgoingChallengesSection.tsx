import { useState } from 'react';
import { DS_COLORS } from '@/constants/colors';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useCancelChallenge, useOutgoingChallenges } from '@/hooks/useChallenges';
import { useFeatureGate } from '@/lib/subscription';
import { GAMES } from '@/constants/games';
import type { GameChallenge } from '@/types/realtime';

function gameName(challenge: GameChallenge): string {
  return GAMES.find((g) => g.slug === challenge.gameSlug)?.name ?? challenge.gameSlug;
}

export function OutgoingChallengesSection() {
  const router = useRouter();
  const realtimeGamesEnabled = useFeatureGate('REALTIME_GAMES');
  const { data: challenges } = useOutgoingChallenges();
  const cancelMutation = useCancelChallenge();
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  if (!realtimeGamesEnabled || !challenges || challenges.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
        Sent Challenges
      </Text>
      <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
        {challenges.map((challenge, index) => (
          <View
            key={challenge.id}
            className={`px-4 py-3 flex-row items-center gap-3 ${
              index < challenges.length - 1 ? 'border-b border-ds-outline-variant' : ''
            }`}
          >
            <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
              <Send size={18} color={DS_COLORS.onSurfaceVariant} />
            </View>

            <View className="flex-1">
              <Text className="text-sm font-barlow-semi text-ds-on-surface">
                {challenge.challengeeName}
              </Text>
              <Text className="text-xs font-barlow text-ds-on-surface-variant">
                {gameName(challenge)} · Waiting to accept
              </Text>
            </View>

            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cancel challenge to ${challenge.challengeeName}`}
                className={`border border-ds-outline-variant rounded-lg px-3 py-2 active:opacity-70 ${cancellingIds.has(challenge.id) ? 'opacity-50' : ''}`}
                onPress={() => {
                  setCancellingIds((prev) => new Set(prev).add(challenge.id));
                  cancelMutation.mutate(challenge.id, {
                    onError: () => Alert.alert('Error', 'Failed to cancel challenge.'),
                    onSettled: () =>
                      setCancellingIds((prev) => {
                        const next = new Set(prev);
                        next.delete(challenge.id);
                        return next;
                      }),
                  });
                }}
                disabled={cancellingIds.has(challenge.id)}
              >
                {cancellingIds.has(challenge.id) ? (
                  <ActivityIndicator
                    testID={`cancel-pending-${challenge.id}`}
                    size="small"
                    color={DS_COLORS.onSurfaceVariant}
                  />
                ) : (
                  <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">Cancel</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View challenge to ${challenge.challengeeName}`}
                className="bg-ds-red rounded-lg px-3 py-2 active:opacity-70"
                onPress={() => router.push(`/challenge/${challenge.id}`)}
              >
                <Text className="text-xs font-barlow-semi text-ds-on-red">View</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
