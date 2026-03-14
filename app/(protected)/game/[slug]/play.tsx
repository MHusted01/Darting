import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AroundTheClockPlayPanel } from '@/components/games/AroundTheClockPlayPanel';
import { CricketPlayPanel } from '@/components/games/CricketPlayPanel';
import {
  getMaxTarget,
  type AroundTheClockConfig,
} from '@/lib/games/around-the-clock';
import { usePlaySession } from '@/hooks/usePlaySession';

/**
 * Screen component that hosts an active game session for Around the Clock or Cricket.
 *
 * @returns The rendered Play screen element for the current game session.
 */
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
    localTarget,
    localCricketState,
    handleATCDartThrown,
    handleCricketDartThrown,
    handleQuit,
  } = usePlaySession({ slug, sessionId });

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center px-6">
        <Text className="text-base text-gray-500 text-center mb-4">{loadError}</Text>
        <Pressable
          onPress={() => router.replace('/(protected)/(tabs)')}
          className="bg-black rounded-xl px-5 py-3"
          accessibilityRole="button"
          accessibilityLabel="Go back to games"
        >
          <Text className="text-white font-semibold">Back to games</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!gameState || !currentPlayer) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-400">Loading...</Text>
      </SafeAreaView>
    );
  }

  const maxTarget = isAroundTheClock
    ? getMaxTarget(gameState.config as AroundTheClockConfig)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-8"
        bounces={false}
      >
        <View className="flex-row items-center justify-between mt-2 mb-6">
          <Text className="text-sm text-gray-500">
            Round {gameState.currentRound}
          </Text>
          <Pressable
            onPress={handleQuit}
            className="active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Quit game"
          >
            <Text className="text-sm text-red-500 font-medium">Quit</Text>
          </Pressable>
        </View>

        <View className="items-center mb-4">
          <View
            className="w-12 h-12 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: currentPlayer.avatarColor }}
          >
            <Text className="text-white text-lg font-bold">
              {currentPlayer.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-xl font-bold text-black">
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
      </ScrollView>
    </SafeAreaView>
  );
}
