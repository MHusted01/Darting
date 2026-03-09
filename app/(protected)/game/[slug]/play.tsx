import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { gameSessions, gamePlayers, gameTurns } from '@/db/schema';
import { AROUND_THE_CLOCK_SLUG, CRICKET_SLUG } from '@/constants/games';
import { AroundTheClockInput } from '@/components/games/AroundTheClockInput';
import { CricketInput } from '@/components/games/CricketInput';
import { CricketScoreboard } from '@/components/games/CricketScoreboard';
import {
  getTargetSegment,
  getTargetLabel,
  getMaxTarget,
  type AroundTheClockConfig,
  type AroundTheClockPlayerState,
} from '@/lib/games/around-the-clock';
import {
  processTurn as processCricketTurn,
  type CricketConfig,
  type CricketPlayerState,
} from '@/lib/games/cricket';
import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadedPlayer {
  id: number; // gamePlayers.id
  playerId: number;
  playerOrder: number;
  name: string;
  avatarColor: string;
  currentScore: number;
  gameState: unknown;
  isWinner: boolean;
}

interface GameState {
  sessionId: number;
  gameSlug: string;
  currentRound: number;
  currentPlayerIndex: number;
  config: unknown;
  players: LoadedPlayer[];
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PlayScreen() {
  const router = useRouter();
  const { slug, sessionId } = useLocalSearchParams<{
    slug: string;
    sessionId: string;
  }>();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [turnDarts, setTurnDarts] = useState<DartThrow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // ATC-specific local state
  const [localTarget, setLocalTarget] = useState<number>(1);

  // Cricket-specific local state
  const [localCricketState, setLocalCricketState] =
    useState<CricketPlayerState | null>(null);

  const isAroundTheClock = gameState?.gameSlug === AROUND_THE_CLOCK_SLUG;
  const isCricket = gameState?.gameSlug === CRICKET_SLUG;

  // -----------------------------------------------------------------------
  // Load session from DB
  // -----------------------------------------------------------------------
  const loadSession = useCallback(async () => {
    setLoadError(null);

    if (!sessionId) {
      setGameState(null);
      setLoadError('Missing game session.');
      return;
    }

    try {
      const session = await db.query.gameSessions.findFirst({
        where: eq(gameSessions.id, Number(sessionId)),
        with: {
          gamePlayers: {
            with: { player: true },
            orderBy: [asc(gamePlayers.playerOrder)],
          },
        },
      });

      if (!session || session.status !== 'in_progress') {
        setGameState(null);
        setLoadError('This session is no longer active.');
        return;
      }

      const loadedPlayers: LoadedPlayer[] = session.gamePlayers.map((gp) => ({
        id: gp.id,
        playerId: gp.playerId,
        playerOrder: gp.playerOrder,
        name: gp.player.name,
        avatarColor: gp.player.avatarColor,
        currentScore: gp.currentScore,
        gameState: gp.gameState,
        isWinner: gp.isWinner ?? false,
      }));

      setGameState({
        sessionId: session.id,
        gameSlug: session.gameSlug,
        currentRound: session.currentRound,
        currentPlayerIndex: session.currentPlayerIndex,
        config: session.config,
        players: loadedPlayers,
      });

      // Reset turn state for the new player
      setTurnDarts([]);
      const currentPlayer = loadedPlayers[session.currentPlayerIndex];

      if (session.gameSlug === AROUND_THE_CLOCK_SLUG) {
        const atcState = currentPlayer.gameState as AroundTheClockPlayerState;
        setLocalTarget(atcState.currentTarget);
        setLocalCricketState(null);
      } else if (session.gameSlug === CRICKET_SLUG) {
        setLocalCricketState(currentPlayer.gameState as CricketPlayerState);
      }
    } catch {
      setGameState(null);
      setLoadError('Failed to load game session.');
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // -----------------------------------------------------------------------
  // Turn completion — shared logic
  // -----------------------------------------------------------------------
  const finishTurn = useCallback(
    async (
      darts: DartThrow[],
      scoreDelta: number,
      newPlayerState: unknown,
      newScore: number,
      isComplete: boolean,
      winnerPlayerId?: number,
    ) => {
      if (!gameState) return;
      setIsProcessing(true);

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];

      try {
        await db.transaction(async (tx) => {
          // 1. Insert turn
          await tx.insert(gameTurns).values({
            gameSessionId: gameState.sessionId,
            playerId: currentPlayer.playerId,
            roundNumber: gameState.currentRound,
            darts,
            scoreDelta,
          });

          // 2. Update current player state
          await tx
            .update(gamePlayers)
            .set({
              currentScore: newScore,
              gameState: newPlayerState as Record<string, unknown>,
              isWinner:
                isComplete && (winnerPlayerId ?? currentPlayer.id) === currentPlayer.id,
            })
            .where(eq(gamePlayers.id, currentPlayer.id));

          // 3. If a different player won (Cricket edge case)
          if (
            isComplete &&
            winnerPlayerId !== undefined &&
            winnerPlayerId !== currentPlayer.id
          ) {
            await tx
              .update(gamePlayers)
              .set({ isWinner: true })
              .where(eq(gamePlayers.id, winnerPlayerId));
          }

          // 4. Update session
          if (isComplete) {
            await tx
              .update(gameSessions)
              .set({ status: 'completed', completedAt: new Date() })
              .where(eq(gameSessions.id, gameState.sessionId));
          } else {
            const playerCount = gameState.players.length;
            const nextIdx =
              (gameState.currentPlayerIndex + 1) % playerCount;
            const nextRound =
              nextIdx === 0
                ? gameState.currentRound + 1
                : gameState.currentRound;

            await tx
              .update(gameSessions)
              .set({
                currentPlayerIndex: nextIdx,
                currentRound: nextRound,
              })
              .where(eq(gameSessions.id, gameState.sessionId));
          }
        });

        if (isComplete) {
          router.replace(
            `/game/${slug}/results?sessionId=${gameState.sessionId}`,
          );
        } else {
          await loadSession();
        }
      } catch {
        Alert.alert('Error', 'Failed to record turn.');
      } finally {
        setIsProcessing(false);
      }
    },
    [gameState, loadSession, router, slug],
  );

  // -----------------------------------------------------------------------
  // ATC dart handling
  // -----------------------------------------------------------------------
  const handleATCDartThrown = useCallback(
    async (dart: DartThrow) => {
      if (!gameState || isProcessing) return;

      const newDarts = [...turnDarts, dart];
      setTurnDarts(newDarts);

      let newTarget = localTarget;
      if (dart.segment === getTargetSegment(localTarget) && dart.multiplier > 0) {
        newTarget = localTarget + 1;
        setLocalTarget(newTarget);
      }

      const config = gameState.config as AroundTheClockConfig;
      const maxTarget = getMaxTarget(config);
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const startTarget = (currentPlayer.gameState as AroundTheClockPlayerState)
        .currentTarget;

      if (newTarget > maxTarget) {
        await finishTurn(
          newDarts,
          newTarget - startTarget,
          { currentTarget: newTarget } satisfies AroundTheClockPlayerState,
          currentPlayer.currentScore + (newTarget - startTarget),
          true,
        );
        return;
      }

      if (newDarts.length === 3) {
        await finishTurn(
          newDarts,
          newTarget - startTarget,
          { currentTarget: newTarget } satisfies AroundTheClockPlayerState,
          currentPlayer.currentScore + (newTarget - startTarget),
          false,
        );
      }
    },
    [finishTurn, gameState, turnDarts, localTarget, isProcessing],
  );

  // -----------------------------------------------------------------------
  // Cricket dart handling
  // -----------------------------------------------------------------------
  const handleCricketDartThrown = useCallback(
    async (dart: DartThrow) => {
      if (!gameState || isProcessing) return;

      const newDarts = [...turnDarts, dart];
      setTurnDarts(newDarts);

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const startState = currentPlayer.gameState as CricketPlayerState;
      const config = gameState.config as CricketConfig;

      // Process ALL darts so far against original state (idempotent)
      const allPlayerStates = gameState.players.map(
        (p) => p.gameState as CricketPlayerState,
      );
      const result = processCricketTurn(
        newDarts,
        startState,
        allPlayerStates,
        gameState.currentPlayerIndex,
        config,
      );

      setLocalCricketState(result.newState);

      if (result.isComplete) {
        const winnerId =
          result.winnerIndex !== null
            ? gameState.players[result.winnerIndex].id
            : currentPlayer.id;
        await finishTurn(
          newDarts,
          result.scoreDelta,
          result.newState,
          result.newState.points,
          true,
          winnerId,
        );
        return;
      }

      if (newDarts.length === 3) {
        await finishTurn(
          newDarts,
          result.scoreDelta,
          result.newState,
          result.newState.points,
          false,
        );
      }
    },
    [finishTurn, gameState, turnDarts, isProcessing],
  );

  // -----------------------------------------------------------------------
  // Quit game
  // -----------------------------------------------------------------------
  const handleQuit = useCallback(() => {
    Alert.alert('Quit Game', 'Are you sure you want to abandon this game?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Quit',
        style: 'destructive',
        onPress: async () => {
          if (!gameState) return;
          await db
            .update(gameSessions)
            .set({ status: 'abandoned', completedAt: new Date() })
            .where(eq(gameSessions.id, gameState.sessionId));
          router.replace('/(protected)/(tabs)');
        },
      },
    ]);
  }, [gameState, router]);

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
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

  if (!gameState) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-400">Loading...</Text>
      </SafeAreaView>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-8"
        bounces={false}
      >
        {/* Header */}
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

        {/* Current player */}
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

        {/* ATC: Target display */}
        {isAroundTheClock && (() => {
          const config = gameState.config as AroundTheClockConfig;
          const maxTarget = getMaxTarget(config);
          return (
            <View className="items-center mb-8">
              <Text className="text-sm text-gray-500 mb-1">Target</Text>
              <Text className="text-7xl font-bold text-black">
                {localTarget > maxTarget ? '\u2713' : getTargetLabel(localTarget)}
              </Text>
              {localTarget <= maxTarget && (
                <Text className="text-sm text-gray-400 mt-1">
                  {localTarget} of {maxTarget}
                </Text>
              )}
            </View>
          );
        })()}

        {/* Cricket: Live points */}
        {isCricket && localCricketState && (
          <View className="items-center mb-6">
            <Text className="text-sm text-gray-500 mb-1">Points</Text>
            <Text className="text-5xl font-bold text-black">
              {localCricketState.points}
            </Text>
          </View>
        )}

        {/* Dart input */}
        {isAroundTheClock && (
          <AroundTheClockInput
            currentTarget={localTarget}
            dartIndex={turnDarts.length}
            thrownDarts={turnDarts}
            onDartThrown={handleATCDartThrown}
            disabled={
              isProcessing ||
              localTarget > getMaxTarget(gameState.config as AroundTheClockConfig)
            }
          />
        )}

        {isCricket && (
          <CricketInput
            dartIndex={turnDarts.length}
            thrownDarts={turnDarts}
            onDartThrown={handleCricketDartThrown}
            disabled={isProcessing}
          />
        )}

        {/* ATC Scoreboard */}
        {isAroundTheClock && (() => {
          const config = gameState.config as AroundTheClockConfig;
          const maxTarget = getMaxTarget(config);
          return (
            <View className="mt-8">
              <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                Scoreboard
              </Text>
              {gameState.players.map((player) => {
                const atcState = player.gameState as AroundTheClockPlayerState;
                const isCurrent = player.id === currentPlayer.id;
                const playerTarget =
                  isCurrent && localTarget !== atcState.currentTarget
                    ? localTarget
                    : atcState.currentTarget;
                const isFinished = playerTarget > maxTarget;

                return (
                  <View
                    key={player.id}
                    className={`flex-row items-center py-3 px-3 rounded-lg mb-1 ${
                      isCurrent ? 'bg-gray-100' : ''
                    }`}
                  >
                    <View
                      className="w-6 h-6 rounded-full mr-3"
                      style={{ backgroundColor: player.avatarColor }}
                    />
                    <Text
                      className={`flex-1 text-base ${
                        isCurrent ? 'font-bold text-black' : 'text-gray-700'
                      }`}
                    >
                      {player.name}
                    </Text>
                    <Text
                      className={`text-sm ${
                        isFinished
                          ? 'text-emerald-600 font-bold'
                          : 'text-gray-500'
                      }`}
                    >
                      {isFinished
                        ? 'Done!'
                        : `${playerTarget - 1}/${maxTarget}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* Cricket Scoreboard */}
        {isCricket && localCricketState && (
          <CricketScoreboard
            players={gameState.players.map((player, i) => {
              const isCurrent = i === gameState.currentPlayerIndex;
              const state = isCurrent
                ? localCricketState
                : (player.gameState as CricketPlayerState);
              return {
                name: player.name,
                avatarColor: player.avatarColor,
                marks: state.marks,
                points: state.points,
                isCurrent,
              };
            })}
            currentPlayerIndex={gameState.currentPlayerIndex}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
