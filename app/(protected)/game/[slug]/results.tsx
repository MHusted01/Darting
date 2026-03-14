import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { eq, asc } from 'drizzle-orm';
import { Trophy } from 'lucide-react-native';
import { db } from '@/db/client';
import { gameSessions, gamePlayers } from '@/db/schema';
import { AROUND_THE_CLOCK_SLUG, CRICKET_SLUG } from '@/constants/games';
import { ATCResultsRows } from '@/components/games/ATCResultsRows';
import { CricketResultsRows } from '@/components/games/CricketResultsRows';
import {
  buildATCResults,
  buildCricketResults,
  type GameResults,
  type SessionResultPlayerInput,
  type SessionTurnInput,
} from '@/lib/games/results';
import type { AroundTheClockConfig } from '@/lib/games/around-the-clock';
import type { DartThrow } from '@/types/game';

/**
 * Displays the results screen for a completed game session.
 *
 * @returns A React element rendering winner details, rankings, and action buttons.
 */
export default function ResultsScreen() {
  const router = useRouter();
  const { slug, sessionId } = useLocalSearchParams<{
    slug: string;
    sessionId: string;
  }>();

  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);

  const loadResults = useCallback(async () => {
    setLoading(true);

    try {
      if (!sessionId) {
        setResults(null);
        return;
      }

      const session = await db.query.gameSessions.findFirst({
        where: eq(gameSessions.id, Number(sessionId)),
        with: {
          gamePlayers: {
            with: { player: true },
            orderBy: [asc(gamePlayers.playerOrder)],
          },
          gameTurns: true,
        },
      });

      if (!session) {
        setResults(null);
        return;
      }

      const players: SessionResultPlayerInput[] = session.gamePlayers.map((gp) => ({
        playerId: gp.playerId,
        name: gp.player.name,
        avatarColor: gp.player.avatarColor,
        gameState: gp.gameState,
        isWinner: gp.isWinner ?? false,
      }));

      const turns: SessionTurnInput[] = session.gameTurns.map((turn) => ({
        playerId: turn.playerId,
        darts: turn.darts as DartThrow[],
      }));

      if (session.gameSlug === AROUND_THE_CLOCK_SLUG) {
        setResults({
          type: 'atc',
          players: buildATCResults(
            players,
            turns,
            session.config as AroundTheClockConfig,
          ),
        });
        return;
      }

      if (session.gameSlug === CRICKET_SLUG) {
        setResults({
          type: 'cricket',
          players: buildCricketResults(players, turns),
        });
        return;
      }

      setResults(null);
    } catch (error) {
      console.error('Failed to load game results:', error);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-400">Loading results...</Text>
      </SafeAreaView>
    );
  }

  if (!results) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center px-6">
        <Text className="text-base text-gray-500 text-center mb-4">
          Could not load results for this session.
        </Text>
        <Pressable
          onPress={() => router.replace('/(protected)/(tabs)')}
          className="bg-black rounded-xl px-5 py-3"
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          <Text className="text-white font-semibold">Home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const winnerName = results.players.find((player) => player.isWinner)?.name;
  const winnerSubtitle =
    results.type === 'atc'
      ? (() => {
          const winner = results.players.find((player) => player.isWinner);
          return winner
            ? `${winner.targetsHit}/${winner.maxTarget} in ${winner.turns} turns`
            : '';
        })()
      : (() => {
          const winner = results.players.find((player) => player.isWinner);
          return winner
            ? `${winner.points} pts \u2022 ${winner.segmentsClosed}/7 closed`
            : '';
        })();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-12 pt-6"
      >
        {winnerName && (
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-full bg-amber-100 items-center justify-center mb-3">
              <Trophy size={32} color="#f59e0b" />
            </View>
            <Text className="text-sm text-gray-500 mb-1">Winner</Text>
            <Text className="text-3xl font-bold text-black">{winnerName}</Text>
            <Text className="text-base text-gray-500 mt-1">{winnerSubtitle}</Text>
          </View>
        )}

        <View className="mb-8">
          <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            Rankings
          </Text>

          {results.type === 'atc' ? (
            <ATCResultsRows players={results.players} />
          ) : (
            <CricketResultsRows players={results.players} />
          )}
        </View>

        <View className="gap-3">
          <Pressable
            onPress={() => router.replace(`/game/${slug}`)}
            className="bg-black rounded-xl py-4 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Play again"
          >
            <Text className="text-white text-lg font-bold">Play Again</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(protected)/(tabs)')}
            className="border border-gray-300 rounded-xl py-4 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Go to home"
          >
            <Text className="text-gray-600 text-lg font-bold">Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
