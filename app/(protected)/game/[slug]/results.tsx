import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { eq, asc } from 'drizzle-orm';
import { Trophy } from 'lucide-react-native';
import { db } from '@/db/client';
import { gameSessions, gamePlayers } from '@/db/schema';
import { AROUND_THE_CLOCK_SLUG, CRICKET_SLUG } from '@/constants/games';
import {
  getMaxTarget,
  type AroundTheClockConfig,
  type AroundTheClockPlayerState,
} from '@/lib/games/around-the-clock';
import {
  CRICKET_SEGMENTS,
  isSegmentClosed,
  isCricketSegment,
  type CricketPlayerState,
} from '@/lib/games/cricket';
import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ATCPlayerResult {
  name: string;
  avatarColor: string;
  targetsHit: number;
  maxTarget: number;
  isWinner: boolean;
  totalDarts: number;
  hits: number;
  turns: number;
}

interface CricketPlayerResult {
  name: string;
  avatarColor: string;
  isWinner: boolean;
  points: number;
  segmentsClosed: number;
  totalDarts: number;
  cricketHits: number;
  totalMarks: number;
  turns: number;
}

type GameResults =
  | { type: 'atc'; players: ATCPlayerResult[] }
  | { type: 'cricket'; players: CricketPlayerResult[] };

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

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

      if (session.gameSlug === AROUND_THE_CLOCK_SLUG) {
        const config = session.config as AroundTheClockConfig;
        const maxTarget = getMaxTarget(config);

        const players: ATCPlayerResult[] = session.gamePlayers.map((gp) => {
          const state = gp.gameState as AroundTheClockPlayerState;
          const playerTurns = session.gameTurns.filter(
            (t) => t.playerId === gp.playerId,
          );

          let totalDarts = 0;
          let hits = 0;
          for (const turn of playerTurns) {
            const darts = turn.darts as DartThrow[];
            totalDarts += darts.length;
            hits += darts.filter((d) => d.segment > 0 && d.multiplier > 0).length;
          }

          return {
            name: gp.player.name,
            avatarColor: gp.player.avatarColor,
            targetsHit: Math.min(state.currentTarget - 1, maxTarget),
            maxTarget,
            isWinner: gp.isWinner ?? false,
            totalDarts,
            hits,
            turns: playerTurns.length,
          };
        });

        players.sort((a, b) => {
          if (a.isWinner && !b.isWinner) return -1;
          if (!a.isWinner && b.isWinner) return 1;
          return b.targetsHit - a.targetsHit;
        });

        setResults({ type: 'atc', players });
      } else if (session.gameSlug === CRICKET_SLUG) {
        const players: CricketPlayerResult[] = session.gamePlayers.map((gp) => {
          const state = gp.gameState as CricketPlayerState;
          const playerTurns = session.gameTurns.filter(
            (t) => t.playerId === gp.playerId,
          );

          let totalDarts = 0;
          let cricketHits = 0;
          let totalMarks = 0;
          for (const turn of playerTurns) {
            const darts = turn.darts as DartThrow[];
            totalDarts += darts.length;
            for (const dart of darts) {
              if (dart.segment > 0 && dart.multiplier > 0 && isCricketSegment(dart.segment)) {
                cricketHits++;
                totalMarks += dart.multiplier;
              }
            }
          }

          const segmentsClosed = CRICKET_SEGMENTS.filter((seg) =>
            isSegmentClosed(state.marks[seg]),
          ).length;

          return {
            name: gp.player.name,
            avatarColor: gp.player.avatarColor,
            isWinner: gp.isWinner ?? false,
            points: state.points,
            segmentsClosed,
            totalDarts,
            cricketHits,
            totalMarks,
            turns: playerTurns.length,
          };
        });

        players.sort((a, b) => {
          if (a.isWinner && !b.isWinner) return -1;
          if (!a.isWinner && b.isWinner) return 1;
          if (b.points !== a.points) return b.points - a.points;
          return b.segmentsClosed - a.segmentsClosed;
        });

        setResults({ type: 'cricket', players });
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadResults();
  }, [loadResults, slug, sessionId]);

  if (loading || !results) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-400">Loading results...</Text>
      </SafeAreaView>
    );
  }

  const winnerName =
    results.type === 'atc'
      ? results.players.find((r) => r.isWinner)?.name
      : results.players.find((r) => r.isWinner)?.name;

  const winnerSubtitle =
    results.type === 'atc'
      ? (() => {
          const w = results.players.find((r) => r.isWinner);
          return w ? `${w.targetsHit}/${w.maxTarget} in ${w.turns} turns` : '';
        })()
      : (() => {
          const w = results.players.find((r) => r.isWinner);
          return w ? `${w.points} pts \u2022 ${w.segmentsClosed}/7 closed` : '';
        })();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-12 pt-6"
      >
        {/* Winner announcement */}
        {winnerName && (
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-full bg-amber-100 items-center justify-center mb-3">
              <Trophy size={32} color="#f59e0b" />
            </View>
            <Text className="text-sm text-gray-500 mb-1">Winner</Text>
            <Text className="text-3xl font-bold text-black">{winnerName}</Text>
            <Text className="text-base text-gray-500 mt-1">
              {winnerSubtitle}
            </Text>
          </View>
        )}

        {/* Rankings */}
        <View className="mb-8">
          <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            Rankings
          </Text>

          {results.type === 'atc' &&
            results.players.map((result, index) => (
              <View
                key={result.name + index}
                className={`flex-row items-center py-4 px-4 rounded-xl mb-2 ${
                  result.isWinner ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                }`}
              >
                <Text className="text-lg font-bold text-gray-400 w-8">
                  {index + 1}
                </Text>
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: result.avatarColor }}
                >
                  <Text className="text-white text-sm font-bold">
                    {result.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-black">
                    {result.name}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {result.totalDarts} darts •{' '}
                    {result.totalDarts > 0
                      ? Math.round((result.hits / result.totalDarts) * 100)
                      : 0}
                    % hit rate
                  </Text>
                </View>
                <Text
                  className={`text-base font-bold ${
                    result.isWinner ? 'text-amber-600' : 'text-gray-600'
                  }`}
                >
                  {result.targetsHit}/{result.maxTarget}
                </Text>
              </View>
            ))}

          {results.type === 'cricket' &&
            results.players.map((result, index) => {
              const markingRate =
                result.totalDarts > 0
                  ? Math.round((result.totalMarks / (result.totalDarts * 3)) * 100)
                  : 0;

              return (
                <View
                  key={result.name + index}
                  className={`flex-row items-center py-4 px-4 rounded-xl mb-2 ${
                    result.isWinner ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                  }`}
                >
                  <Text className="text-lg font-bold text-gray-400 w-8">
                    {index + 1}
                  </Text>
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: result.avatarColor }}
                  >
                    <Text className="text-white text-sm font-bold">
                      {result.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-black">
                      {result.name}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {result.totalDarts} darts • {result.segmentsClosed}/7 closed •{' '}
                      {markingRate}% marking rate
                    </Text>
                  </View>
                  <Text
                    className={`text-base font-bold ${
                      result.isWinner ? 'text-amber-600' : 'text-gray-600'
                    }`}
                  >
                    {result.points} pts
                  </Text>
                </View>
              );
            })}
        </View>

        {/* Actions */}
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
