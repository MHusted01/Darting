import { useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AroundTheClockPlayPanel } from '@/components/games/AroundTheClockPlayPanel';
import { BaseballPlayPanel } from '@/components/games/BaseballPlayPanel';
import { BermudaTrianglePlayPanel } from '@/components/games/BermudaTrianglePlayPanel';
import { Bobs27PlayPanel } from '@/components/games/Bobs27PlayPanel';
import { CricketPlayPanel } from '@/components/games/CricketPlayPanel';
import { HalveItPlayPanel } from '@/components/games/HalveItPlayPanel';
import { HighScorePlayPanel } from '@/components/games/HighScorePlayPanel';
import { KillerPlayPanel } from '@/components/games/KillerPlayPanel';
import { ShanghaiPlayPanel } from '@/components/games/ShanghaiPlayPanel';
import { X01PlayPanel } from '@/components/games/X01PlayPanel';
import {
  getMaxTarget,
  type AroundTheClockConfig,
} from '@/lib/games/around-the-clock';
import { usePlaySession, type LoadedGameState } from '@/hooks/usePlaySession';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import type { DartThrow } from '@/types/game';

type BeforeCommitTurn = (
  darts: DartThrow[],
  isComplete: boolean,
  winnerGamePlayerId: number | null | undefined,
  gameState: LoadedGameState,
  newScore: number,
) => Promise<void>;

export default function PlayScreen() {
  const router = useRouter();
  const { slug, sessionId, challengeId } = useLocalSearchParams<{
    slug: string;
    sessionId: string;
    challengeId?: string;
  }>();
  const isRealtimeMatch = Boolean(challengeId);

  const beforeCommitRef = useRef<BeforeCommitTurn | null>(null);
  const onBeforeCommitTurn = useCallback<BeforeCommitTurn>(
    (...args) => beforeCommitRef.current?.(...args) ?? Promise.resolve(),
    [],
  );

  const abandonRef = useRef<(() => Promise<void>) | null>(null);
  const onQuitConfirmed = useCallback(() => abandonRef.current?.() ?? Promise.resolve(), []);

  const {
    gameState,
    currentPlayer,
    loadError,
    turnDarts,
    isProcessing,
    isAroundTheClock,
    isCricket,
    isX01,
    isShanghai,
    isBaseball,
    isHighScore,
    isHalveIt,
    isBobs27,
    isBermudaTriangle,
    isKiller,
    localTarget,
    localCricketState,
    localX01State,
    handleATCDartThrown,
    handleCricketDartThrown,
    handleX01DartThrown,
    handleRoundDartThrown,
    handleKillerDartThrown,
    handleQuit,
    applyRemoteTurn,
  } = usePlaySession({
    slug,
    sessionId,
    onBeforeCommitTurn: isRealtimeMatch ? onBeforeCommitTurn : undefined,
    onQuitConfirmed: isRealtimeMatch ? onQuitConfirmed : undefined,
  });

  const realtime = useRealtimeGame({
    challengeId: challengeId ?? null,
    gameState,
    applyRemoteTurn,
  });
  beforeCommitRef.current = realtime.onBeforeCommitTurn;
  abandonRef.current = realtime.abandon;

  const waitingForOpponent = isRealtimeMatch && !realtime.isMyTurn;
  const inputDisabled = isProcessing || waitingForOpponent;

  const opponentAbandoned = isRealtimeMatch && realtime.challengeStatus === 'abandoned';

  useEffect(() => {
    if (!opponentAbandoned) return;
    Alert.alert('Match ended', 'Your opponent left the game.', [
      { text: 'OK', onPress: () => router.replace('/(protected)/(tabs)') },
    ]);
  }, [opponentAbandoned, router]);

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg justify-center items-center px-6">
        <Text className="text-base font-barlow text-ds-on-surface-variant text-center mb-4">
          {loadError}
        </Text>
        <Pressable
          onPress={() => router.replace('/(protected)/(tabs)')}
          className="bg-ds-red rounded-xl px-5 py-3 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Go back to games"
        >
          <Text className="text-white font-barlow-semi">Back to games</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!gameState || !currentPlayer) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg justify-center items-center">
        <Text className="text-ds-outline font-barlow">Loading...</Text>
      </SafeAreaView>
    );
  }

  const maxTarget = isAroundTheClock
    ? getMaxTarget(gameState.config as AroundTheClockConfig)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-8"
        bounces={false}
      >
        <View className="flex-row items-center justify-between mt-2 mb-6">
          <Text className="text-sm font-barlow text-ds-on-surface-variant">
            Round {gameState.currentRound}
          </Text>
          <Pressable
            onPress={handleQuit}
            className="active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Quit game"
          >
            <Text className="text-sm font-barlow-semi text-ds-red">Quit</Text>
          </Pressable>
        </View>

        {isRealtimeMatch && !realtime.opponentOnline && (
          <View className="bg-ds-red-container rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm font-barlow-semi text-ds-red text-center">
              Opponent is offline
            </Text>
          </View>
        )}

        {waitingForOpponent && (
          <View className="bg-ds-surface-low border border-ds-outline-variant rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm font-barlow-semi text-ds-on-surface-variant text-center">
              Waiting for {currentPlayer.name}…
            </Text>
          </View>
        )}

        <View className="items-center mb-6">
          <View
            className="w-12 h-12 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: currentPlayer.avatarColor }}
          >
            <Text className="text-white text-lg font-barlow-bold">
              {currentPlayer.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">
            {currentPlayer.name}
          </Text>
        </View>

        {isAroundTheClock && maxTarget !== null && (
          <AroundTheClockPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            localTarget={localTarget}
            maxTarget={maxTarget}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleATCDartThrown}
          />
        )}

        {isCricket && localCricketState && (
          <CricketPlayPanel
            players={gameState.players}
            currentPlayerIndex={gameState.currentPlayerIndex}
            localCricketState={localCricketState}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleCricketDartThrown}
          />
        )}

        {isX01 && localX01State && (
          <X01PlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            localX01State={localX01State}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleX01DartThrown}
          />
        )}

        {isShanghai && (
          <ShanghaiPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isBaseball && (
          <BaseballPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isHighScore && (
          <HighScorePlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isHalveIt && (
          <HalveItPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isBobs27 && (
          <Bobs27PlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isBermudaTriangle && (
          <BermudaTrianglePlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isKiller && (
          <KillerPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={inputDisabled}
            onDartThrown={handleKillerDartThrown}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
