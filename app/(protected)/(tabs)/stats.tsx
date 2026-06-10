import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { Lock, Settings, TrendingUp } from 'lucide-react-native';
import { getHistoryData, type HistoryQuickStats, type HistorySessionItem } from '@/lib/history';
import {
  getPersonalBests,
  getOverallThreeDartAvg,
  getSegmentAccuracy,
  getCheckoutStats,
  getPerGameKPIs,
  getAggregatedStats,
  getTrendData,
  type PersonalBest,
  type StatsFilter,
  type AggregatedKPIs,
  type TrendPoint,
} from '@/lib/stats';
import { generateSuggestions } from '@/lib/suggestions';
import { useFeatureGate } from '@/lib/subscription';
import { getUserPlayerId } from '@/lib/player';
import { GAMES, IMPLEMENTED_SLUGS } from '@/constants/games';
import KPICard from '@/components/KPICard';
import SegmentHeatmap from '@/components/SegmentHeatmap';
import CheckoutAnalysis from '@/components/CheckoutAnalysis';
import type { SessionContext } from '@/lib/games/analytics';

const STATUS_LABELS: Record<HistorySessionItem['status'], string> = {
  setup: 'Setup',
  in_progress: 'In Progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

const STATUS_STYLES: Record<HistorySessionItem['status'], { bg: string; text: string }> = {
  setup:       { bg: 'bg-ds-surface-low',   text: 'text-ds-on-surface-variant' },
  in_progress: { bg: 'bg-ds-green',         text: 'text-ds-green-dark' },
  completed:   { bg: 'bg-ds-surface-low',   text: 'text-ds-on-surface-variant' },
  abandoned:   { bg: 'bg-ds-red-container', text: 'text-ds-red' },
};

const EMPTY_STATS: HistoryQuickStats = {
  gamesPlayed: 0,
  completedCount: 0,
  winRate: 0,
  inProgressSessions: 0,
  abandonedSessions: 0,
};

type TimeFilter = '7d' | '30d' | 'all';
type ContextFilter = SessionContext | 'all';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30d', label: 'Last 30d' },
  { key: '7d', label: 'Last 7d' },
];

const CONTEXT_FILTERS: { key: ContextFilter; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'all', label: 'All' },
];

const X01_SLUG = 'x01';
const isX01 = (slug: string | null): slug is string => slug === X01_SLUG;

const IMPLEMENTED_GAME_NAMES = GAMES.filter((g) => IMPLEMENTED_SLUGS.has(g.slug));

function KPIGrid({ kpis }: { kpis: AggregatedKPIs }) {
  if (kpis.type === 'x01') {
    const avg = kpis.threeDartAvg != null ? kpis.threeDartAvg.toFixed(1) : '—';
    const first9 = kpis.first9DartAvg != null ? kpis.first9DartAvg.toFixed(1) : '—';
    const checkout = kpis.checkoutRate != null ? `${Math.round(kpis.checkoutRate * 100)}%` : '—';
    const bust = kpis.bustRate != null ? `${Math.round(kpis.bustRate * 100)}%` : '—';
    const best = kpis.highestCheckout ?? '—';
    return (
      <View className="gap-3">
        <View className="flex-row gap-3">
          <KPICard label="3-Dart Avg" value={avg} />
          <KPICard label="First 9 Avg" value={first9} />
        </View>
        <View className="flex-row gap-3">
          <KPICard label="Checkout %" value={checkout} />
          <KPICard label="Bust Rate" value={bust} />
        </View>
        <View className="flex-row gap-3">
          <KPICard label="Best Checkout" value={best} />
        </View>
        <View className="flex-row gap-3">
          <KPICard label="180s" value={kpis.ton80Count} />
          <KPICard label="140s" value={kpis.ton40Count} />
          <KPICard label="100s" value={kpis.tonCount} />
        </View>
      </View>
    );
  }

  if (kpis.type === 'cricket') {
    const mpr = kpis.marksPerRound != null ? kpis.marksPerRound.toFixed(2) : '—';
    const CRICKET_SEGS: { num: number; label: string }[] = [
      { num: 15, label: '15' }, { num: 16, label: '16' }, { num: 17, label: '17' },
      { num: 18, label: '18' }, { num: 19, label: '19' }, { num: 20, label: '20' },
      { num: 25, label: 'Bull' },
    ];
    const segEntries = CRICKET_SEGS.filter(({ num }) => kpis.hitRateBySegment[num] != null);
    return (
      <View className="gap-3">
        <View className="flex-row gap-3">
          <KPICard label="Marks / Round" value={mpr} subtitle="Target: 3.0+" />
        </View>
        {segEntries.length > 0 && (
          <View>
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Hit Rate by Segment
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {segEntries.map(({ num, label }) => (
                <KPICard
                  key={num}
                  label={label}
                  value={`${Math.round((kpis.hitRateBySegment[num] ?? 0) * 100)}%`}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  if (kpis.type === 'target') {
    const hitRate = kpis.overallHitRate != null ? `${Math.round(kpis.overallHitRate * 100)}%` : '—';
    const totalDarts = Object.values(kpis.hitRateByRound).reduce((s, r) => s + r.darts, 0);
    const worstRounds = Object.entries(kpis.hitRateByRound)
      .sort((a, b) => a[1].rate - b[1].rate)
      .slice(0, 3);
    return (
      <View className="gap-3">
        <View className="flex-row gap-3">
          <KPICard label="Hit Rate" value={hitRate} />
          {totalDarts > 0 && <KPICard label="Total Darts" value={totalDarts} />}
        </View>
        {worstRounds.length > 0 && (
          <View>
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Weakest Numbers
            </Text>
            <View className="flex-row gap-2">
              {worstRounds.map(([round, data]) => (
                <KPICard
                  key={round}
                  label={`No. ${round}`}
                  value={`${Math.round(data.rate * 100)}%`}
                  subtitle={`${data.hits}/${data.darts}`}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  if (kpis.type === 'highscore') {
    const avg = kpis.avgPerRound != null ? kpis.avgPerRound.toFixed(1) : '—';
    const best = kpis.bestRound ?? '—';
    return (
      <View className="flex-row gap-3">
        <KPICard label="Avg / Round" value={avg} />
        <KPICard label="Best Round" value={best} />
      </View>
    );
  }

  return null;
}

function filterByTime(sessions: HistorySessionItem[], filter: TimeFilter): HistorySessionItem[] {
  if (filter === 'all') return sessions;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (filter === '7d' ? 7 : 30));
  return sessions.filter((s) => s.lastActivityAt >= cutoff);
}

function filterBySlug(sessions: HistorySessionItem[], slug: string | null): HistorySessionItem[] {
  if (!slug) return sessions;
  return sessions.filter((s) => s.gameSlug === slug);
}

function StatsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const hasFocusedOnce = useRef(false);
  const hasAnimatedRows = useRef(false);
  useEffect(() => {
    hasAnimatedRows.current = true;
  }, []);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('casual');

  const hasUnlimitedHistory = useFeatureGate('UNLIMITED_STATS_HISTORY');
  const historySince = useMemo(
    () => (hasUnlimitedHistory ? undefined : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
    [hasUnlimitedHistory],
  );
  const trendLimit = hasUnlimitedHistory ? 30 : 10;

  const historyQuery = useQuery({
    queryKey: ['history'],
    queryFn: getHistoryData,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const playerIdQuery = useQuery({
    queryKey: ['user-player-id', userId],
    queryFn: () => getUserPlayerId(userId!),
    enabled: Boolean(userId),
    staleTime: Infinity,
  });

  const playerId = playerIdQuery.data ?? null;

  const statsQuery = useQuery({
    queryKey: ['stats', 'personal-bests', playerId],
    queryFn: () => getPersonalBests(playerId!),
    enabled: playerId != null,
    staleTime: 60_000,
  });

  const avgQuery = useQuery({
    queryKey: ['stats', 'three-dart-avg', playerId],
    queryFn: () => getOverallThreeDartAvg(playerId!),
    enabled: playerId != null,
    staleTime: 60_000,
  });

  const statsFilter: StatsFilter = {
    context: contextFilter === 'all' ? 'all' : contextFilter,
    since: historySince,
  };

  const segmentFilter: StatsFilter = { ...statsFilter, slug: activeSlug ?? undefined };

  const segmentQuery = useQuery({
    queryKey: ['stats', 'segment-accuracy', playerId, activeSlug, contextFilter, historySince?.getTime()],
    queryFn: () => getSegmentAccuracy(playerId!, segmentFilter),
    enabled: playerId != null,
    staleTime: 60_000,
  });

  const kpiQuery = useQuery({
    queryKey: ['stats', 'kpi', playerId, activeSlug, contextFilter, historySince?.getTime()],
    queryFn: () => getPerGameKPIs(playerId!, activeSlug!, statsFilter),
    enabled: playerId != null && activeSlug != null,
    staleTime: 60_000,
  });

  const checkoutQuery = useQuery({
    queryKey: ['stats', 'checkout', playerId, contextFilter, historySince?.getTime()],
    queryFn: () => getCheckoutStats(playerId!, statsFilter),
    enabled: playerId != null && isX01(activeSlug),
    staleTime: 60_000,
  });

  const aggStatsQuery = useQuery({
    queryKey: ['stats', 'agg', playerId, contextFilter, historySince?.getTime()],
    queryFn: () => getAggregatedStats(playerId!, statsFilter),
    enabled: playerId != null,
    staleTime: 60_000,
  });

  const trendFilter: StatsFilter = { ...statsFilter, slug: activeSlug ?? undefined };

  const trendQuery = useQuery({
    queryKey: ['stats', 'trend', playerId, trendLimit, activeSlug, contextFilter, historySince?.getTime()],
    queryFn: () => getTrendData(playerId!, trendLimit, trendFilter),
    enabled: playerId != null,
    staleTime: 60_000,
  });

  const { data, isLoading, isRefetching, error: historyError, refetch } = historyQuery;
  const refetchPersonalBests = statsQuery.refetch;
  const refetchOverallAvg = avgQuery.refetch;
  const refetchSegment = segmentQuery.refetch;
  const refetchKpi = kpiQuery.refetch;
  const refetchCheckout = checkoutQuery.refetch;
  const refetchAggStats = aggStatsQuery.refetch;
  const refetchTrend = trendQuery.refetch;

  useEffect(() => {
    if (!historyError) return;
    Alert.alert(
      'Stats Error',
      historyError instanceof Error ? historyError.message : 'Could not load game history right now.',
    );
  }, [historyError]);

  const allSessions: HistorySessionItem[] = data?.sessions ?? [];
  const quickStats: HistoryQuickStats = data?.quickStats ?? EMPTY_STATS;
  const personalBests: PersonalBest[] = statsQuery.data ?? [];
  const overallAvg: number | null = avgQuery.data ?? null;
  const loading = isLoading;
  const refreshing = isRefetching;
  const hasError = Boolean(historyError);

  const filteredSessions = filterBySlug(filterByTime(allSessions, timeFilter), activeSlug);
  const segmentAccuracy = segmentQuery.data ?? {};
  const kpiData: AggregatedKPIs | null = kpiQuery.data ?? null;
  const trendPoints: TrendPoint[] = trendQuery.data ?? [];
  const checkoutData = checkoutQuery.data ?? null;
  const suggestions = aggStatsQuery.data ? generateSuggestions(aggStatsQuery.data) : [];
  const gamesPlayed = aggStatsQuery.data?.gamesPlayed ?? 0;

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      void refetch();
      void refetchPersonalBests();
      void refetchOverallAvg();
      void refetchSegment();
      void refetchKpi();
      void refetchCheckout();
      void refetchAggStats();
      void refetchTrend();
    }, [refetch, refetchPersonalBests, refetchOverallAvg, refetchSegment, refetchKpi, refetchCheckout, refetchAggStats, refetchTrend]),
  );

  const handleOpenSession = useCallback(
    (session: HistorySessionItem) => {
      if (session.status === 'setup') {
        router.push(`/game/${session.gameSlug}`);
        return;
      }
      if (session.status === 'in_progress') {
        router.push(`/game/${session.gameSlug}/play?sessionId=${session.sessionId}`);
        return;
      }
      router.push(`/game/${session.gameSlug}/results?sessionId=${session.sessionId}`);
    },
    [router],
  );

  const recentForChart = allSessions.slice(0, trendLimit);

  const renderSessionRow = useCallback(
    ({ item }: { item: HistorySessionItem }) => {
      const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.abandoned;
      const statusLabel = STATUS_LABELS[item.status] ?? 'Unknown';
      const initials = item.gameName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

      return (
        <Pressable
          onPress={() => handleOpenSession(item)}
          className="flex-row items-center px-4 py-3 gap-3 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={`${item.gameName} ${statusLabel} session`}
        >
          <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">{initials}</Text>
          </View>

          <View className="flex-1">
            <Text className="text-sm font-barlow-semi text-ds-on-surface">{item.gameName}</Text>
            <Text className="text-xs font-barlow text-ds-on-surface-variant">
              {item.playerCount} players
            </Text>
          </View>

          <View className={`w-8 h-8 rounded-full items-center justify-center ${statusStyle.bg}`}>
            <Text className={`text-xs font-barlow-semi ${statusStyle.text}`}>
              {statusLabel.slice(0, 1)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [handleOpenSession],
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg justify-center items-center" edges={['top']}>
        <Text className="font-barlow text-ds-on-surface-variant">Loading stats...</Text>
      </SafeAreaView>
    );
  }

  const avgDisplay = overallAvg != null ? overallAvg.toFixed(1) : '—';

  const hasAvg = overallAvg != null;

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1 }}>
      <FlatList
        testID="tabs-stats-flatlist"
        data={filteredSessions}
        keyExtractor={(item) => `${item.sessionId}`}
        contentContainerStyle={{ paddingBottom: 32 }}
        onRefresh={() => { void refetch(); void refetchPersonalBests(); void refetchOverallAvg(); void refetchSegment(); void refetchKpi(); void refetchCheckout(); void refetchAggStats(); void refetchTrend(); }}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
              <Text className="text-2xl font-barlow-condensed-xbold text-ds-on-surface tracking-tight">STATS</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => router.push('/(protected)/settings')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className="active:opacity-70"
              >
                <Settings size={22} color="#444748" />
              </Pressable>
            </View>

            {/* 501 / 301 Average hero */}
            <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl p-5">
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
                501 / 301 Average
              </Text>
              <Text className="text-6xl font-barlow-bold text-ds-on-surface leading-none mb-3">
                {avgDisplay}
              </Text>
              <View className="self-start bg-ds-green rounded-full px-3 py-1 flex-row items-center gap-1">
                <TrendingUp size={18} color="#444748" />
                <Text className="text-xs font-barlow-semi text-ds-green-dark">
                  {hasAvg ? '3-dart avg across 501 / 301 games' : 'Play a 501 or 301 game to see your average'}
                </Text>
              </View>
            </View>

            {/* Stat tiles row */}
            <View className="flex-row mx-6 gap-3 mb-4">
              <View className="flex-1 bg-ds-surface border border-ds-outline-variant rounded-2xl p-4">
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
                  Games Played
                </Text>
                <Text className="text-4xl font-barlow-bold text-ds-on-surface leading-none">
                  {quickStats.gamesPlayed}
                </Text>
              </View>
              <View className="flex-1 bg-ds-surface border border-ds-outline-variant rounded-2xl p-4">
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
                  Completed
                </Text>
                <Text className="text-4xl font-barlow-bold text-ds-on-surface leading-none">
                  {quickStats.completedCount}
                </Text>
              </View>
            </View>

            {/* Personal Bests */}
            {personalBests.length > 0 && (
              <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl overflow-hidden">
                <View className="px-4 pt-4 pb-2">
                  <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest">
                    Personal Bests
                  </Text>
                </View>
                {personalBests.map((pb, idx) => (
                  <View
                    key={pb.gameSlug}
                    className={`px-4 py-3 flex-row items-center justify-between${idx < personalBests.length - 1 ? ' border-b border-ds-outline-variant' : ''}`}
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-barlow-semi text-ds-on-surface">{pb.gameName}</Text>
                      <Text className="text-xs font-barlow text-ds-on-surface-variant">
                        {pb.gamesPlayed} played · {pb.gamesWon} won
                      </Text>
                    </View>
                    <View className="items-end">
                      {pb.bestScore != null && (
                        <Text className="text-sm font-barlow-semi text-ds-on-surface">
                          Best: {pb.bestScore}
                        </Text>
                      )}
                      {pb.avgThreeDartAvg != null && (
                        <Text className="text-xs font-barlow text-ds-on-surface-variant">
                          Avg: {pb.avgThreeDartAvg.toFixed(1)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Context filter */}
            <View className="flex-row mx-6 gap-2 mb-4">
              {CONTEXT_FILTERS.map(({ key, label }) => (
                <Pressable
                  key={key}
                  onPress={() => setContextFilter(key)}
                  className={`px-3 py-1.5 rounded-full border active:opacity-70 ${
                    contextFilter === key
                      ? 'bg-ds-red border-ds-red'
                      : 'bg-ds-surface border-ds-outline-variant'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={`Context filter ${label}`}
                >
                  <Text className={`text-xs font-barlow-semi ${contextFilter === key ? 'text-white' : 'text-ds-on-surface-variant'}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Segment Heatmap */}
            {Object.keys(segmentAccuracy).length > 0 && (
              <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl p-4">
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
                  Segment Accuracy
                </Text>
                <SegmentHeatmap
                  accuracy={segmentAccuracy}
                  onSegmentPress={(segment, stat) => {
                    const label = segment === '25' ? 'Bull' : `Segment ${segment}`;
                    const total = stat.singles + stat.doubles + stat.triples;
                    Alert.alert(
                      label,
                      `Singles: ${stat.singles}  Doubles: ${stat.doubles}  Triples: ${stat.triples}\nTotal throws: ${total}`,
                    );
                  }}
                />
              </View>
            )}

            {/* Per-game KPI section */}
            {activeSlug != null && kpiData != null && (
              <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl p-4">
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
                  {GAMES.find((g) => g.slug === activeSlug)?.name ?? activeSlug} KPIs
                </Text>
                <KPIGrid kpis={kpiData} />
              </View>
            )}

            {/* Checkout Analysis (X01 only) */}
            {isX01(activeSlug) && (
              <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl p-4">
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
                  Checkout Analysis
                </Text>
                <CheckoutAnalysis summary={checkoutData} />
              </View>
            )}

            {/* Suggestions */}
            <View className="mx-6 mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-barlow-condensed text-ds-on-surface">Coaching Tips</Text>
                <Pressable onPress={() => router.push('/drill')} className="active:opacity-70" accessibilityRole="button" accessibilityLabel="Browse all drills">
                  <Text className="text-sm font-barlow-semi text-ds-red">Browse all →</Text>
                </Pressable>
              </View>
              {gamesPlayed >= 5 && suggestions.map((s) => (
                <Pressable
                  key={s.drillSlug}
                  onPress={() => router.push(`/drill/${s.drillSlug}`)}
                  className="bg-ds-surface border border-ds-outline-variant rounded-xl p-4 mb-2 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={s.reason}
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className={`px-2 py-0.5 rounded-full ${s.urgency === 'high' ? 'bg-ds-red-container' : s.urgency === 'medium' ? 'bg-ds-surface-container' : 'bg-ds-surface-low'}`}>
                      <Text className={`text-xs font-barlow-semi capitalize ${s.urgency === 'high' ? 'text-ds-red' : 'text-ds-on-surface-variant'}`}>
                        {s.urgency}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm font-barlow text-ds-on-surface-variant">{s.reason}</Text>
                </Pressable>
              ))}
              {gamesPlayed >= 5 && suggestions.length === 0 && (
                <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-3">
                  <Text className="text-sm font-barlow text-ds-on-surface-variant">
                    No suggestions right now — keep playing!
                  </Text>
                </View>
              )}
              {gamesPlayed < 5 && (
                <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-3">
                  <Text className="text-sm font-barlow text-ds-on-surface-variant">
                    Play 5 games to unlock coaching suggestions.
                  </Text>
                </View>
              )}
            </View>

            {/* 3-Dart Avg trend chart (per-game when slug active) */}
            {trendPoints.length > 0 && (() => {
              const withAvg = trendPoints.filter((p) => p.threeDartAvg != null);
              if (withAvg.length === 0) return null;
              const maxAvg = Math.max(...withAvg.map((p) => p.threeDartAvg!));
              const chartPoints = [...trendPoints].reverse();
              const trendLabel = activeSlug
                ? `Last ${trendPoints.length} ${GAMES.find((g) => g.slug === activeSlug)?.name ?? activeSlug} Sessions`
                : `Last ${trendPoints.length} Sessions`;
              return (
                <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl p-4">
                  <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
                    {trendLabel} — 3-Dart Avg
                  </Text>
                  <View className="flex-row items-end gap-1 h-16">
                    {chartPoints.map((p) => {
                      const val = p.threeDartAvg;
                      const heightPct = val != null && maxAvg > 0 ? Math.max(val / maxAvg, 0.05) : 0.05;
                      return (
                        <View
                          key={p.sessionId}
                          className="flex-1 rounded bg-ds-green-dark"
                          style={{ height: `${Math.round(heightPct * 100)}%`, opacity: val != null ? 1 : 0.2 }}
                        />
                      );
                    })}
                  </View>
                  <View className="flex-row justify-between mt-2">
                    <Text className="text-xs font-barlow text-ds-on-surface-variant">OLDER</Text>
                    <Text className="text-xs font-barlow text-ds-on-surface-variant">RECENT</Text>
                  </View>
                </View>
              );
            })()}

            {/* Session status form chart (shown when no slug filter or no trend data) */}
            {recentForChart.length > 0 && trendPoints.length === 0 && (
              <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest">
                    Last {recentForChart.length} Sessions Form
                  </Text>
                  <Text className="text-xs font-barlow-semi text-ds-on-surface">
                    {quickStats.completedCount}C – {quickStats.abandonedSessions}A
                  </Text>
                </View>
                <View className="flex-row items-end gap-1.5 h-16">
                  {recentForChart.map((s) => {
                    const isCompleted = s.status === 'completed';
                    const isAbandoned = s.status === 'abandoned';
                    const isInProgress = s.status === 'in_progress';
                    const heightClass = isCompleted ? 'h-14' : isAbandoned ? 'h-8' : isInProgress ? 'h-5' : 'h-2';
                    const colorClass = isCompleted ? 'bg-ds-green-dark' : isAbandoned ? 'bg-ds-red' : isInProgress ? 'bg-ds-outline-variant' : 'bg-ds-surface-container';
                    return (
                      <View
                        key={s.sessionId}
                        className={`flex-1 rounded ${heightClass} ${colorClass}`}
                      />
                    );
                  })}
                </View>
                <View className="flex-row justify-between mt-2">
                  <Text className="text-xs font-barlow text-ds-on-surface-variant">OLDER</Text>
                  <Text className="text-xs font-barlow text-ds-on-surface-variant">RECENT</Text>
                </View>
                <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-3">
                  {([
                    { color: 'bg-ds-green-dark', label: 'Completed' },
                    { color: 'bg-ds-red', label: 'Abandoned' },
                    { color: 'bg-ds-outline-variant', label: 'In Progress' },
                    { color: 'bg-ds-surface-container', label: 'Setup' },
                  ] as const).map(({ color, label }) => (
                    <View key={label} className="flex-row items-center gap-1.5">
                      <View className={`w-2 h-2 rounded-full ${color}`} />
                      <Text className="text-xs font-barlow text-ds-on-surface-variant">{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Upgrade prompt (history gate) */}
            {!hasUnlimitedHistory && (
              <View className="mx-6 mb-4 flex-row items-center gap-2 bg-ds-surface-low border border-ds-outline-variant rounded-xl px-4 py-3">
                <Lock size={16} color="#747878" />
                <Text className="flex-1 text-xs font-barlow text-ds-on-surface-variant">
                  Upgrade to Pro for full stats history
                </Text>
              </View>
            )}

            {/* Recent Matches header + filters */}
            <View className="px-6 mb-2">
              <Text className="text-xl font-barlow-condensed text-ds-on-surface mb-3">Recent Matches</Text>

              {/* Time filter pills */}
              <View className="flex-row gap-2 mb-2">
                {TIME_FILTERS.map(({ key, label }) => (
                  <Pressable
                    key={key}
                    onPress={() => setTimeFilter(key)}
                    className={`px-3 py-1.5 rounded-full border active:opacity-70 ${
                      timeFilter === key
                        ? 'bg-ds-red border-ds-red'
                        : 'bg-ds-surface border-ds-outline-variant'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${label}`}
                  >
                    <Text
                      className={`text-xs font-barlow-semi ${
                        timeFilter === key ? 'text-white' : 'text-ds-on-surface-variant'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Game type filter pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                <View className="flex-row gap-2 pb-1">
                  <Pressable
                    onPress={() => setActiveSlug(null)}
                    className={`px-3 py-1.5 rounded-full border active:opacity-70 ${
                      activeSlug === null
                        ? 'bg-ds-on-surface border-ds-on-surface'
                        : 'bg-ds-surface border-ds-outline-variant'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel="Show all games"
                  >
                    <Text
                      className={`text-xs font-barlow-semi ${
                        activeSlug === null ? 'text-white' : 'text-ds-on-surface-variant'
                      }`}
                    >
                      All
                    </Text>
                  </Pressable>
                  {IMPLEMENTED_GAME_NAMES.map((game) => (
                    <Pressable
                      key={game.slug}
                      onPress={() => setActiveSlug(activeSlug === game.slug ? null : game.slug)}
                      className={`px-3 py-1.5 rounded-full border active:opacity-70 ${
                        activeSlug === game.slug
                          ? 'bg-ds-red border-ds-red'
                          : 'bg-ds-surface border-ds-outline-variant'
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by ${game.name}`}
                    >
                      <Text
                        className={`text-xs font-barlow-semi ${
                          activeSlug === game.slug ? 'text-white' : 'text-ds-on-surface-variant'
                        }`}
                      >
                        {game.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Session list container top border */}
            {filteredSessions.length > 0 && (
              <View className="mx-6 bg-ds-surface border border-ds-outline-variant rounded-2xl overflow-hidden" />
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={
              hasAnimatedRows.current ? undefined : FadeInDown.duration(200).delay(Math.min(index, 8) * 40)
            }
          >
            <View className={`mx-6 bg-ds-surface border-x border-ds-outline-variant ${
              index === filteredSessions.length - 1 ? 'border-b rounded-b-2xl' : 'border-b'
            } ${index === 0 ? 'border-t rounded-t-2xl' : ''}`}>
              {renderSessionRow({ item })}
            </View>
          </Animated.View>
        )}
        ListEmptyComponent={
          hasError ? null : (
            <View className="mx-6 border border-dashed border-ds-outline-variant rounded-2xl p-8 items-center">
              <Text className="text-base font-barlow-semi text-ds-on-surface mb-1">No sessions yet</Text>
              <Text className="text-sm font-barlow text-ds-on-surface-variant text-center">
                {activeSlug || timeFilter !== 'all'
                  ? 'No sessions match the current filter.'
                  : 'Start a game from Home and your sessions will appear here.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={null}
      />
      </Animated.View>
    </SafeAreaView>
  );
}

export default withErrorBoundary(StatsScreen, 'stats');
