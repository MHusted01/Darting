import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AroundTheClockPlayPanel } from '@/components/games/AroundTheClockPlayPanel';
import { BaseballPlayPanel } from '@/components/games/BaseballPlayPanel';
import { Bobs27PlayPanel } from '@/components/games/Bobs27PlayPanel';
import { CricketPlayPanel } from '@/components/games/CricketPlayPanel';
import { HalveItPlayPanel } from '@/components/games/HalveItPlayPanel';
import { HighScorePlayPanel } from '@/components/games/HighScorePlayPanel';
import { ShanghaiPlayPanel } from '@/components/games/ShanghaiPlayPanel';
import { X01PlayPanel } from '@/components/games/X01PlayPanel';
import {
  getMaxTarget,
  type AroundTheClockConfig,
} from '@/lib/games/around-the-clock';
import { usePlaySession } from '@/hooks/usePlaySession';

export default function PlayScreen() {
  const router = useRouter();
  const { slug, sessionId } = useLocalSearchParams<{
    slug: string;
    sessionId: string;
  }>();

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
    localTarget,
    localCricketState,
    localX01State,
    handleATCDartThrown,
    handleCricketDartThrown,
    handleX01DartThrown,
    handleRoundDartThrown,
    handleQuit,
  } = usePlaySession({ slug, sessionId });

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
            isProcessing={isProcessing}
            onDartThrown={handleATCDartThrown}
          />
        )}

        {isCricket && localCricketState && (
          <CricketPlayPanel
            players={gameState.players}
            currentPlayerIndex={gameState.currentPlayerIndex}
            localCricketState={localCricketState}
            turnDarts={turnDarts}
            isProcessing={isProcessing}
            onDartThrown={handleCricketDartThrown}
          />
        )}

        {isX01 && localX01State && (
          <X01PlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            localX01State={localX01State}
            turnDarts={turnDarts}
            isProcessing={isProcessing}
            onDartThrown={handleX01DartThrown}
          />
        )}

        {isShanghai && (
          <ShanghaiPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={isProcessing}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isBaseball && (
          <BaseballPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={isProcessing}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isHighScore && (
          <HighScorePlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={isProcessing}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isHalveIt && (
          <HalveItPlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={isProcessing}
            onDartThrown={handleRoundDartThrown}
          />
        )}

        {isBobs27 && (
          <Bobs27PlayPanel
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            turnDarts={turnDarts}
            isProcessing={isProcessing}
            onDartThrown={handleRoundDartThrown}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
