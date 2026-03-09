import { useState, useCallback } from 'react';
import { View, Text, Pressable, Switch, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GAMES, AROUND_THE_CLOCK_SLUG, CRICKET_SLUG } from '@/constants/games';
import { db } from '@/db/client';
import { players as playersTable, gameSessions, gamePlayers } from '@/db/schema';
import {
  PlayerManager,
  getNextAvatarColor,
  type Player,
} from '@/components/PlayerManager';
import { getInitialPlayerState as getATCInitialState } from '@/lib/games/around-the-clock';
import type { AroundTheClockConfig } from '@/lib/games/around-the-clock';
import { getInitialPlayerState as getCricketInitialState } from '@/lib/games/cricket';
import type { CricketConfig } from '@/lib/games/cricket';

export default function GameSetup() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;
  const game = GAMES.find((g) => g.slug === normalizedSlug);
  const isAroundTheClock = normalizedSlug === AROUND_THE_CLOCK_SLUG;
  const isCricket = normalizedSlug === CRICKET_SLUG;

  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [includeBull, setIncludeBull] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleAddPlayer = useCallback(
    async (name: string) => {
      const color = getNextAvatarColor(selectedPlayers.length);
      const [inserted] = await db
        .insert(playersTable)
        .values({ name, avatarColor: color })
        .returning();

      setSelectedPlayers((prev) => [
        ...prev,
        { id: inserted.id, name: inserted.name, avatarColor: inserted.avatarColor },
      ]);
    },
    [selectedPlayers.length],
  );

  const handleRemovePlayer = useCallback((playerId: number) => {
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== playerId));
  }, []);

  const minPlayers = isCricket ? 2 : 1;

  const handleStartGame = async () => {
    if (selectedPlayers.length < minPlayers || isStarting) return;

    if (!isAroundTheClock && !isCricket) {
      Alert.alert('Not available yet', 'This game mode is not implemented yet.');
      return;
    }

    setIsStarting(true);

    try {
      const config = isAroundTheClock
        ? ({ includeBull } satisfies AroundTheClockConfig)
        : ({ variant: 'standard' } satisfies CricketConfig);

      const getInitialState = isAroundTheClock
        ? getATCInitialState
        : getCricketInitialState;

      const session = await db.transaction(async (tx) => {
        const [session] = await tx
          .insert(gameSessions)
          .values({
            gameSlug: normalizedSlug,
            status: 'in_progress',
            currentRound: 1,
            currentPlayerIndex: 0,
            config,
            startedAt: new Date(),
          })
          .returning();

        for (let i = 0; i < selectedPlayers.length; i++) {
          await tx.insert(gamePlayers).values({
            gameSessionId: session.id,
            playerId: selectedPlayers[i].id,
            playerOrder: i,
            currentScore: 0,
            gameState: getInitialState(),
          });
        }

        return session;
      });

      router.push(`/game/${normalizedSlug}/play?sessionId=${session.id}`);
    } catch {
      Alert.alert('Error', 'Failed to start game. Please try again.');
      setIsStarting(false);
    }
  };

  if (!game) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-lg text-gray-500">Game not found</Text>
      </View>
    );
  }

  const Icon = game.icon;
  const canStart = selectedPlayers.length >= minPlayers && !isStarting;

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-6 pb-12 pt-6"
      keyboardShouldPersistTaps="handled"
    >
      {/* Game header */}
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center mb-4">
          <Icon size={32} color="black" />
        </View>
        <Text className="text-2xl font-bold text-black mb-1">{game.name}</Text>
        <Text className="text-base text-gray-500 text-center">
          {game.description}
        </Text>
      </View>

      {/* Player management */}
      <PlayerManager
        players={selectedPlayers}
        onAddPlayer={handleAddPlayer}
        onRemovePlayer={handleRemovePlayer}
        minPlayers={minPlayers}
      />

      {/* Game config */}
      {isAroundTheClock && (
        <View className="mt-6 border border-gray-200 rounded-xl p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-base font-semibold text-black">
                Include Bull
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                Add bullseye as target #21 after completing 1–20
              </Text>
            </View>
            <Switch
              value={includeBull}
              onValueChange={setIncludeBull}
              trackColor={{ false: '#d1d5db', true: '#000000' }}
              thumbColor="white"
              accessibilityLabel="Include bull as target 21"
            />
          </View>
        </View>
      )}

      {/* Cricket config */}
      {isCricket && (
        <View className="mt-6 border border-gray-200 rounded-xl p-4">
          <Text className="text-base font-semibold text-black">
            Standard Cricket
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            Close 15–20 and Bull. Score points on segments your opponents
            haven't closed.
          </Text>
        </View>
      )}

      {/* Start button */}
      <Pressable
        onPress={handleStartGame}
        disabled={!canStart}
        className={`mt-8 rounded-xl py-4 items-center ${
          canStart ? 'bg-black active:opacity-70' : 'bg-gray-200'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Start game"
      >
        <Text
          className={`text-lg font-bold ${canStart ? 'text-white' : 'text-gray-400'}`}
        >
          {isStarting ? 'Starting...' : 'Start Game'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
