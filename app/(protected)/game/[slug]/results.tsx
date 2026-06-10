import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { eq, asc } from 'drizzle-orm';
import { CheckCircle, Trophy } from 'lucide-react-native';
import { useSupabase } from '@/providers/SupabaseProvider';
import { completeTournamentMatch } from '@/lib/tournament-api';
import { db } from '@/db/client';
import { gameSessions, gamePlayers } from '@/db/schema';
import {
  AROUND_THE_CLOCK_SLUG,
  BASEBALL_SLUG,
  BOBS_27_SLUG,
  CRICKET_SLUG,
  HALVE_IT_SLUG,
  HIGH_SCORE_SLUG,
  SHANGHAI_SLUG,
  X01_SLUG,
} from '@/constants/games';
import { ATCResultsRows } from '@/components/games/ATCResultsRows';
import { CricketResultsRows } from '@/components/games/CricketResultsRows';
import { ScoreResultsRows } from '@/components/games/ScoreResultsRows';
import { X01ResultsRows } from '@/components/games/X01ResultsRows';
import {
  buildATCResults,
  buildBaseballResults,
  buildBobs27Results,
  buildCricketResults,
  buildHalveItResults,
  buildHighScoreResults,
  buildShanghaiResults,
  buildX01Results,
  type GameResults,
  type SessionResultPlayerInput,
  type SessionTurnInput,
} from '@/lib/games/results';
import type { AroundTheClockConfig } from '@/lib/games/around-the-clock';
import type { X01Config } from '@/lib/games/x01';
import type { DartThrow } from '@/types/game';

const SCORE_LABEL: Record<string, string> = {
  [SHANGHAI_SLUG]: 'pts',
  [BASEBALL_SLUG]: 'runs',
  [HIGH_SCORE_SLUG]: 'pts',
  [HALVE_IT_SLUG]: 'pts',
  [BOBS_27_SLUG]: 'pts',
};

export default function ResultsScreen() {
  const router = useRouter();
  const { slug, sessionId } = useLocalSearchParams<{
    slug: string;
    sessionId: string;
  }>();
  const supabase = useSupabase();

  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournamentMatchId, setTournamentMatchId] = useState<string | null>(null);
  const [matchRecorded, setMatchRecorded] = useState(false);
  const matchRecordingRef = useRef(false);

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

      if (session.tournamentMatchId) {
        setTournamentMatchId(session.tournamentMatchId);
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

      switch (session.gameSlug) {
        case AROUND_THE_CLOCK_SLUG:
          setResults({
            type: 'atc',
            players: buildATCResults(players, turns, session.config as AroundTheClockConfig),
          });
          break;
        case CRICKET_SLUG:
          setResults({ type: 'cricket', players: buildCricketResults(players, turns) });
          break;
        case SHANGHAI_SLUG:
          setResults({ type: 'score', players: buildShanghaiResults(players, turns) });
          break;
        case BASEBALL_SLUG:
          setResults({ type: 'score', players: buildBaseballResults(players, turns) });
          break;
        case HIGH_SCORE_SLUG:
          setResults({ type: 'score', players: buildHighScoreResults(players, turns) });
          break;
        case HALVE_IT_SLUG:
          setResults({ type: 'score', players: buildHalveItResults(players, turns) });
          break;
        case BOBS_27_SLUG:
          setResults({ type: 'score', players: buildBobs27Results(players, turns) });
          break;
        case X01_SLUG:
          setResults({
            type: 'x01',
            players: buildX01Results(players, turns, session.config as X01Config),
          });
          break;
        default:
          setResults(null);
      }
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

  useEffect(() => {
    if (!tournamentMatchId || matchRecorded || matchRecordingRef.current || !supabase) return;

    const MAX_POLLS = 20;
    let polls = 0;

    const interval = setInterval(async () => {
      polls++;
      if (polls > MAX_POLLS) {
        clearInterval(interval);
        return;
      }
      if (matchRecordingRef.current) return;

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

        if (!session?.cloudSessionId || !session.tournamentMatchId) return;
        if (!session.tournamentParticipant1Id || !session.tournamentParticipant2Id) return;

        const winnerPlayer = session.gamePlayers.find(gp => gp.isWinner);
        if (!winnerPlayer) return;

        const winnerId =
          winnerPlayer.playerOrder === 0
            ? session.tournamentParticipant1Id
            : session.tournamentParticipant2Id;

        matchRecordingRef.current = true;
        await completeTournamentMatch(supabase, session.tournamentMatchId, winnerId, session.cloudSessionId);
        clearInterval(interval);
        setMatchRecorded(true);
      } catch {
        matchRecordingRef.current = false;
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [tournamentMatchId, matchRecorded, supabase, sessionId]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg justify-center items-center">
        <Text className="text-ds-outline font-barlow">Loading results...</Text>
      </SafeAreaView>
    );
  }

  if (!results) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg justify-center items-center px-6">
        <Text className="text-base font-barlow text-ds-on-surface-variant text-center mb-4">
          Could not load results for this session.
        </Text>
        <Pressable
          onPress={() => router.replace('/(protected)/(tabs)')}
          className="bg-ds-red rounded-xl px-5 py-3 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          <Text className="text-white font-barlow-semi">Home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isDraw = results.players.every((p) => !p.isWinner);
  const noWinnerSelected = isDraw;
  const allPlayersTied =
    noWinnerSelected &&
    results.type === 'score' &&
    results.players.every((p) => p.score === results.players[0].score);
  const winnerName = isDraw ? 'Draw!' : results.players.find((p) => p.isWinner)?.name;

  const winnerSubtitle = (() => {
    if (noWinnerSelected) {
      if (results.type === 'atc') return 'All players tied';
      return allPlayersTied ? 'All players tied' : 'No winner selected';
    }
    if (results.type === 'atc') {
      const winner = results.players.find((p) => p.isWinner);
      return winner ? `${winner.targetsHit}/${winner.maxTarget} in ${winner.turns} turns` : '';
    }
    if (results.type === 'cricket') {
      const winner = results.players.find((p) => p.isWinner);
      return winner ? `${winner.points} pts • ${winner.segmentsClosed}/7 closed` : '';
    }
    if (results.type === 'x01') {
      const winner = results.players.find((p) => p.isWinner);
      return winner
        ? `${winner.threeDartAvg.toFixed(1)} avg • ${winner.dartsThrown} darts`
        : '';
    }
    const winner = results.players.find((p) => p.isWinner);
    return winner ? `${winner.score} ${SCORE_LABEL[slug ?? ''] ?? 'pts'}` : '';
  })();

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-12 pt-6"
      >
        {winnerName && (
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-full bg-ds-red-container items-center justify-center mb-3">
              <Trophy size={24} color="#1c1b1b" />
            </View>
            <Text className="text-sm font-barlow text-ds-on-surface-variant mb-1">
              {isDraw ? 'Result' : 'Winner'}
            </Text>
            <Text className="text-3xl font-barlow-condensed-xbold text-ds-on-surface">
              {winnerName}
            </Text>
            <Text className="text-base font-barlow text-ds-on-surface-variant mt-1">
              {winnerSubtitle}
            </Text>
          </View>
        )}

        <View className="mb-8">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
            Rankings
          </Text>

          {results.type === 'atc' && <ATCResultsRows players={results.players} />}
          {results.type === 'cricket' && <CricketResultsRows players={results.players} />}
          {results.type === 'score' && (
            <ScoreResultsRows
              players={results.players}
              scoreLabel={SCORE_LABEL[slug ?? ''] ?? 'pts'}
            />
          )}
          {results.type === 'x01' && (
            <X01ResultsRows players={results.players} />
          )}
        </View>

        {tournamentMatchId && (
          <View className={`rounded-xl px-4 py-3 mb-1 flex-row items-center gap-2 ${matchRecorded ? 'bg-ds-green' : 'bg-ds-surface-container'}`}>
            {matchRecorded && <CheckCircle size={16} color="#1e502a" />}
            <Text className={`text-sm font-barlow-semi flex-1 ${matchRecorded ? 'text-ds-green-dark' : 'text-ds-on-surface-variant'}`}>
              {matchRecorded ? 'Match result recorded' : 'Syncing match result…'}
            </Text>
          </View>
        )}

        <View className="gap-3">
          {tournamentMatchId ? (
            <Pressable
              onPress={() => router.back()}
              className="bg-ds-red rounded-xl py-4 items-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Back to tournament"
            >
              <Text className="text-white text-lg font-barlow-semi">Back to Tournament</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.replace(`/game/${slug}`)}
              className="bg-ds-red rounded-xl py-4 items-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Play again"
            >
              <Text className="text-white text-lg font-barlow-semi">Play Again</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.replace('/(protected)/(tabs)')}
            className="border border-ds-outline-variant rounded-xl py-4 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Go to home"
          >
            <Text className="text-ds-on-surface text-lg font-barlow-semi">Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
