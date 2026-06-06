import { useState, useCallback } from 'react';
import { View, Text, Pressable, Switch, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  GAMES,
  IMPLEMENTED_SLUGS,
  AROUND_THE_CLOCK_SLUG,
  BASEBALL_SLUG,
  BOBS_27_SLUG,
  CRICKET_SLUG,
  HALVE_IT_SLUG,
  HIGH_SCORE_SLUG,
  SHANGHAI_SLUG,
  X01_SLUG,
} from '@/constants/games';
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
import { getInitialPlayerState as getX01InitialState } from '@/lib/games/x01';
import type { X01Config } from '@/lib/games/x01';
import { getInitialPlayerState as getShanghaiInitialState } from '@/lib/games/shanghai';
import { getInitialPlayerState as getBaseballInitialState } from '@/lib/games/baseball';
import { getInitialPlayerState as getHighScoreInitialState } from '@/lib/games/high-score';
import { getInitialPlayerState as getHalveItInitialState } from '@/lib/games/halve-it';
import { getInitialPlayerState as getBobs27InitialState } from '@/lib/games/bobs-27';

function getInitialState(slug: string, startingScore: 501 | 301 = 501): unknown {
  switch (slug) {
    case AROUND_THE_CLOCK_SLUG: return getATCInitialState();
    case CRICKET_SLUG: return getCricketInitialState();
    case X01_SLUG: return getX01InitialState({ startingScore });
    case SHANGHAI_SLUG: return getShanghaiInitialState();
    case BASEBALL_SLUG: return getBaseballInitialState();
    case HIGH_SCORE_SLUG: return getHighScoreInitialState();
    case HALVE_IT_SLUG: return getHalveItInitialState();
    case BOBS_27_SLUG: return getBobs27InitialState();
    default: return {};
  }
}

function getConfig(slug: string, includeBull: boolean, startingScore: 501 | 301 = 501): unknown {
  if (slug === AROUND_THE_CLOCK_SLUG) return { includeBull } satisfies AroundTheClockConfig;
  if (slug === CRICKET_SLUG) return { variant: 'standard' } satisfies CricketConfig;
  if (slug === X01_SLUG) return { startingScore } satisfies X01Config;
  return {};
}

export default function GameSetup() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;
  const game = GAMES.find((g) => g.slug === normalizedSlug);
  const isAroundTheClock = normalizedSlug === AROUND_THE_CLOCK_SLUG;
  const isCricket = normalizedSlug === CRICKET_SLUG;
  const isX01 = normalizedSlug === X01_SLUG;

  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [includeBull, setIncludeBull] = useState(false);
  const [startingScore, setStartingScore] = useState<501 | 301>(501);
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

  const minPlayers = isX01 ? 1 : isCricket ? 2 : 1;

  const handleStartGame = async () => {
    if (selectedPlayers.length < minPlayers || isStarting) return;

    if (!IMPLEMENTED_SLUGS.has(normalizedSlug)) {
      Alert.alert('Not available yet', 'This game mode is not implemented yet.');
      return;
    }

    setIsStarting(true);

    try {
      const config = getConfig(normalizedSlug, includeBull, startingScore);

      const session = await db.transaction(async (tx) => {
        const [createdSession] = await tx
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
            gameSessionId: createdSession.id,
            playerId: selectedPlayers[i].id,
            playerOrder: i,
            currentScore: 0,
            gameState: getInitialState(normalizedSlug, startingScore) as Record<string, unknown>,
          });
        }

        return createdSession;
      });

      router.push(`/game/${normalizedSlug}/play?sessionId=${session.id}`);
    } catch (error) {
      console.error('Failed to start game session:', error);
      Alert.alert('Error', 'Failed to start game. Please try again.');
      setIsStarting(false);
    }
  };

  if (!game) {
    return (
      <View className="flex-1 justify-center items-center bg-ds-bg">
        <Text className="text-lg font-barlow text-ds-on-surface-variant">Game not found</Text>
      </View>
    );
  }

  const Icon = game.icon;
  const canStart = selectedPlayers.length >= minPlayers && !isStarting;

  return (
    <ScrollView
      className="flex-1 bg-ds-bg"
      contentContainerClassName="px-6 pb-12 pt-6"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-2xl bg-ds-surface-container items-center justify-center mb-4">
          <Icon size={32} color="#1c1b1b" />
        </View>
        <Text className="text-2xl font-barlow-condensed text-ds-on-surface mb-1">{game.name}</Text>
        <Text className="text-base font-barlow text-ds-on-surface-variant text-center">
          {game.description}
        </Text>
      </View>

      <PlayerManager
        players={selectedPlayers}
        onAddPlayer={handleAddPlayer}
        onRemovePlayer={handleRemovePlayer}
        minPlayers={minPlayers}
      />

      {isAroundTheClock && (
        <View className="mt-6 bg-ds-surface border border-ds-outline-variant rounded-xl p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-base font-barlow-semi text-ds-on-surface">
                Include Bull
              </Text>
              <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
                Add bullseye as target #21 after completing 1–20
              </Text>
            </View>
            <Switch
              value={includeBull}
              onValueChange={setIncludeBull}
              trackColor={{ false: '#c4c7c7', true: '#ba1a1a' }}
              thumbColor="white"
              accessibilityLabel="Include bull as target 21"
            />
          </View>
        </View>
      )}

      {isCricket && (
        <View className="mt-6 bg-ds-surface border border-ds-outline-variant rounded-xl p-4">
          <Text className="text-base font-barlow-semi text-ds-on-surface">Standard Cricket</Text>
          <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
            Close 15–20 and Bull. Score points on segments your opponents have not closed.
          </Text>
        </View>
      )}

      {isX01 && (
        <View className="mt-6 border border-ds-outline-variant rounded-xl p-4 bg-ds-surface">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
            Starting Score
          </Text>
          <View className="flex-row gap-3">
            {([501, 301] as const).map((score) => (
              <Pressable
                key={score}
                onPress={() => setStartingScore(score)}
                className={`flex-1 rounded-xl py-3 items-center active:opacity-70 ${
                  startingScore === score
                    ? 'bg-ds-red'
                    : 'bg-ds-surface-low border border-ds-outline-variant'
                }`}
                accessibilityRole="button"
                accessibilityLabel={`${score} starting score`}
                accessibilityState={{ selected: startingScore === score }}
              >
                <Text
                  className={`text-lg font-barlow-semi ${
                    startingScore === score ? 'text-white' : 'text-ds-on-surface'
                  }`}
                >
                  {score}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-xs font-barlow text-ds-on-surface-variant mt-3">
            Must finish on a double. Turn busts if remaining goes below 2 or lands on 1.
          </Text>
        </View>
      )}

      <Pressable
        onPress={handleStartGame}
        disabled={!canStart}
        className={`mt-8 rounded-xl py-4 items-center ${
          canStart ? 'bg-ds-red active:opacity-70' : 'bg-ds-surface-container'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Start game"
      >
        <Text
          className={`text-lg font-barlow-semi ${canStart ? 'text-white' : 'text-ds-outline'}`}
        >
          {isStarting ? 'Starting...' : 'Start Game'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
