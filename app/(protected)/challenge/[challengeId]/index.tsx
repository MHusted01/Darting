import { useCallback, useEffect, useRef, useState } from 'react';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';
import { impact } from '@/lib/haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Swords } from 'lucide-react-native';
import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useChallengeChannel } from '@/hooks/useChallengeChannel';
import { getChallenge, startChallenge } from '@/lib/realtime-api';
import { useAcceptChallenge, useCancelChallenge, useDeclineChallenge } from '@/hooks/useChallenges';
import { createLocalChallengeSession } from '@/lib/challenge-session';
import { GAMES } from '@/constants/games';
import type { GameChallenge } from '@/types/realtime';

function PlayerRow({
  name,
  role,
  online,
}: {
  name: string;
  role: string;
  online: boolean;
}) {
  return (
    <View className="px-4 py-4 flex-row items-center justify-between border-b border-ds-outline-variant">
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
          <Text className="text-base font-barlow-semi text-ds-on-surface-variant">
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text className="text-base font-barlow-semi text-ds-on-surface">{name}</Text>
          <Text className="text-xs font-barlow text-ds-outline">{role}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <View
          className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-ds-green-dark' : 'bg-ds-outline-variant'}`}
        />
        <Text className="text-xs font-barlow text-ds-on-surface-variant">
          {online ? 'Online' : 'Offline'}
        </Text>
      </View>
    </View>
  );
}

function ChallengeLobbyScreen() {
  const router = useRouter();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const [isLaunching, setIsLaunching] = useState(false);
  const launchedRef = useRef(false);

  const { data: challenge, isLoading, isError } = useQuery<GameChallenge>({
    queryKey: ['challenge', challengeId],
    queryFn: () => getChallenge(supabase, challengeId!),
    enabled: Boolean(challengeId),
  });

  const acceptMutation = useAcceptChallenge();
  const declineMutation = useDeclineChallenge();
  const cancelMutation = useCancelChallenge();

  const launchGame = useCallback(
    async (current: GameChallenge) => {
      if (launchedRef.current || !userId) return;
      launchedRef.current = true;
      setIsLaunching(true);
      try {
        const sessionId = await createLocalChallengeSession(current, userId);
        router.replace(
          `/game/${current.gameSlug}/play?sessionId=${sessionId}&challengeId=${current.id}`,
        );
      } catch {
        launchedRef.current = false;
        setIsLaunching(false);
        Alert.alert('Error', 'Could not start the game. Please try again.');
      }
    },
    [router, userId],
  );

  const handleChallengeUpdate = useCallback(
    (update: { status: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] });
      if (update.status === 'in_progress' && challengeId) {
        void getChallenge(supabase, challengeId)
          .then((fresh) => launchGame(fresh))
          .catch(() => {});
      }
    },
    [queryClient, challengeId, supabase, launchGame],
  );

  const { onlineUserIds } = useChallengeChannel({
    challengeId: challengeId ?? null,
    mode: 'participant',
    onChallengeUpdate: handleChallengeUpdate,
  });

  useEffect(() => {
    if (challenge?.status === 'in_progress') {
      void launchGame(challenge);
    }
  }, [challenge, launchGame]);

  const isChallenger = challenge?.challengerId === userId;
  const game = challenge ? GAMES.find((g) => g.slug === challenge.gameSlug) : undefined;

  const handleStart = async () => {
    if (!challengeId) return;
    setIsLaunching(true);
    try {
      await startChallenge(supabase, challengeId);
      const fresh = await getChallenge(supabase, challengeId);
      await launchGame(fresh);
    } catch {
      setIsLaunching(false);
      Alert.alert('Error', 'Could not start the challenge. Please try again.');
    }
  };

  const handleAccept = () => {
    if (!challengeId) return;
    void impact('light');
    acceptMutation.mutate(challengeId, {
      onSuccess: (accepted) => {
        if (!accepted) {
          Alert.alert('Unavailable', 'This challenge is no longer available.');
          router.back();
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] });
      },
    });
  };

  const handleDecline = () => {
    if (!challengeId) return;
    void impact('light');
    declineMutation.mutate(challengeId, { onSuccess: () => router.back() });
  };

  const handleCancel = () => {
    if (!challengeId) return;
    cancelMutation.mutate(challengeId, { onSuccess: () => router.back() });
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
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Challenge Lobby</Text>
      </View>

      {isLoading && (
        <View className="px-6 pt-6 gap-3" accessible accessibilityState={{ busy: true }} accessibilityLabel="Loading challenge">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </View>
      )}

      {isError && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm font-barlow text-ds-outline text-center">
            Could not load this challenge.
          </Text>
        </View>
      )}

      {challenge && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="px-6 pt-6">
            <View className="items-center mb-6">
              <View className="w-14 h-14 rounded-full bg-ds-red-container items-center justify-center mb-3">
                <Swords size={24} color="#ba1a1a" />
              </View>
              <Text className="text-2xl font-barlow-condensed text-ds-on-surface">
                {game?.name ?? challenge.gameSlug}
              </Text>
              {challenge.gameSlug === 'x01' && (
                <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
                  Starting score: {challenge.settings.startingScore === 301 ? 301 : 501}
                </Text>
              )}
            </View>

            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Players
            </Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-6">
              <PlayerRow
                name={challenge.challengerName}
                role="Challenger · throws first"
                online={onlineUserIds.has(challenge.challengerId)}
              />
              <PlayerRow
                name={challenge.challengeeName}
                role="Challenged"
                online={onlineUserIds.has(challenge.challengeeId)}
              />
            </View>

            {challenge.status === 'pending' && !isChallenger && (
              <View className="gap-3">
                <Pressable
                  onPress={handleAccept}
                  disabled={acceptMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Accept challenge"
                  className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${acceptMutation.isPending ? 'opacity-50' : ''}`}
                >
                  <Text className="text-white text-base font-barlow-semi">Accept</Text>
                </Pressable>
                <Pressable
                  onPress={handleDecline}
                  disabled={declineMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Decline challenge"
                  className="bg-ds-surface border border-ds-outline-variant rounded-xl py-4 items-center active:opacity-70"
                >
                  <Text className="text-base font-barlow-semi text-ds-on-surface">Decline</Text>
                </Pressable>
              </View>
            )}

            {challenge.status === 'pending' && isChallenger && (
              <View className="gap-3">
                <View className="bg-ds-surface-low border border-ds-outline-variant rounded-xl px-4 py-3">
                  <Text className="text-sm font-barlow text-ds-on-surface-variant text-center">
                    Waiting for {challenge.challengeeName} to accept…
                  </Text>
                </View>
                <Pressable
                  onPress={handleCancel}
                  disabled={cancelMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel challenge"
                  className="bg-ds-surface border border-ds-outline-variant rounded-xl py-4 items-center active:opacity-70"
                >
                  <Text className="text-base font-barlow-semi text-ds-red">Cancel Challenge</Text>
                </Pressable>
              </View>
            )}

            {challenge.status === 'accepted' && (
              <Pressable
                onPress={handleStart}
                disabled={isLaunching}
                accessibilityRole="button"
                accessibilityLabel="Start game"
                className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${isLaunching ? 'opacity-50' : ''}`}
              >
                <Text className="text-white text-base font-barlow-semi">
                  {isLaunching ? 'Starting…' : 'Start Game'}
                </Text>
              </Pressable>
            )}

            {(challenge.status === 'declined' ||
              challenge.status === 'cancelled' ||
              challenge.status === 'abandoned') && (
              <View className="bg-ds-surface-low border border-ds-outline-variant rounded-xl px-4 py-3">
                <Text className="text-sm font-barlow text-ds-on-surface-variant text-center">
                  This challenge was {challenge.status}.
                </Text>
              </View>
            )}

            {challenge.status === 'complete' && (
              <View className="bg-ds-surface-low border border-ds-outline-variant rounded-xl px-4 py-3">
                <Text className="text-sm font-barlow text-ds-on-surface-variant text-center">
                  This match has finished.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default withErrorBoundary(ChallengeLobbyScreen, 'challenge-lobby');
