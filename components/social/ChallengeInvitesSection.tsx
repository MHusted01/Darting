import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Swords } from 'lucide-react-native';
import { useDeclineChallenge, useIncomingChallenges } from '@/hooks/useChallenges';
import { useFeatureGate } from '@/lib/subscription';
import { GAMES } from '@/constants/games';
import type { GameChallenge } from '@/types/realtime';

function gameName(challenge: GameChallenge): string {
  return GAMES.find((g) => g.slug === challenge.gameSlug)?.name ?? challenge.gameSlug;
}

export function ChallengeInvitesSection() {
  const router = useRouter();
  const realtimeGamesEnabled = useFeatureGate('REALTIME_GAMES');
  const { data: challenges } = useIncomingChallenges();
  const declineMutation = useDeclineChallenge();

  if (!realtimeGamesEnabled || !challenges || challenges.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
        Game Challenges
      </Text>
      <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
        {challenges.map((challenge, index) => (
          <View
            key={challenge.id}
            className={`px-4 py-3 flex-row items-center gap-3 ${
              index < challenges.length - 1 ? 'border-b border-ds-outline-variant' : ''
            }`}
          >
            <View className="w-10 h-10 rounded-full bg-ds-red-container items-center justify-center">
              <Swords size={18} color="#ba1a1a" />
            </View>

            <View className="flex-1">
              <Text className="text-sm font-barlow-semi text-ds-on-surface">
                {challenge.challengerName}
              </Text>
              <Text className="text-xs font-barlow text-ds-on-surface-variant">
                {gameName(challenge)}
              </Text>
            </View>

            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decline challenge from ${challenge.challengerName}`}
                className={`border border-ds-outline-variant rounded-lg px-3 py-2 active:opacity-70 ${declineMutation.isPending ? 'opacity-50' : ''}`}
                onPress={() => declineMutation.mutate(challenge.id)}
                disabled={declineMutation.isPending}
              >
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">Decline</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View challenge from ${challenge.challengerName}`}
                className="bg-ds-red rounded-lg px-3 py-2 active:opacity-70"
                onPress={() => router.push(`/challenge/${challenge.id}`)}
              >
                <Text className="text-xs font-barlow-semi text-white">View</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
