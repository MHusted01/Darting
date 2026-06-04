import { useCallback, useEffect, useRef } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Settings, TrendingUp } from 'lucide-react-native';
import { getHistoryData, type HistoryQuickStats, type HistorySessionItem } from '@/lib/history';

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

/**
 * Render the Stats screen showing aggregate quick stats and a list of past game sessions with refresh and navigation.
 *
 * Displays a header with aggregated statistics, a scrollable list of sessions, pull-to-refresh and retry-on-error controls, and navigates to the appropriate game screen when a session is opened.
 *
 * @returns The Stats screen component as a JSX element
 */
export default function StatsScreen() {
  const router = useRouter();
  const hasFocusedOnce = useRef(false);

  const historyQuery = useQuery({
    queryKey: ['history'],
    queryFn: getHistoryData,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data, isLoading, isRefetching, error: historyError, refetch } = historyQuery;

  useEffect(() => {
    if (!historyError) return;
    Alert.alert(
      'Stats Error',
      historyError instanceof Error ? historyError.message : 'Could not load game history right now.',
    );
  }, [historyError]);

  const sessions: HistorySessionItem[] = data?.sessions ?? [];
  const quickStats: HistoryQuickStats = data?.quickStats ?? EMPTY_STATS;
  const loading = isLoading;
  const refreshing = isRefetching;
  const hasError = Boolean(historyError);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      void refetch();
    }, [refetch]),
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

  const recentForChart = sessions.slice(0, 10);

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

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <FlatList
        testID="tabs-stats-flatlist"
        data={sessions}
        keyExtractor={(item) => `${item.sessionId}`}
        contentContainerStyle={{ paddingBottom: 32 }}
        onRefresh={() => { void refetch(); }}
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

            {/* 3-Dart Average hero */}
            <View className="mx-6 mb-4 bg-ds-surface border border-ds-outline-variant rounded-2xl p-5">
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
                3-Dart Average
              </Text>
              <Text className="text-6xl font-barlow-bold text-ds-on-surface leading-none mb-3">—</Text>
              <View className="self-start bg-ds-green rounded-full px-3 py-1 flex-row items-center gap-1">
                <TrendingUp size={12} color="#1e502a" />
                <Text className="text-xs font-barlow-semi text-ds-green-dark">Coming soon</Text>
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

            {/* Form chart */}
            {recentForChart.length > 0 && (
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

            {/* Recent Matches header */}
            <View className="px-6 mb-2">
              <Text className="text-xl font-barlow-condensed text-ds-on-surface">Recent Matches</Text>
            </View>

            {/* Session list container top border */}
            {sessions.length > 0 && (
              <View className="mx-6 bg-ds-surface border border-ds-outline-variant rounded-2xl overflow-hidden" />
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <View className={`mx-6 bg-ds-surface border-x border-ds-outline-variant ${
            index === sessions.length - 1 ? 'border-b rounded-b-2xl' : 'border-b'
          } ${index === 0 ? 'border-t rounded-t-2xl' : ''}`}>
            {renderSessionRow({ item })}
          </View>
        )}
        ListEmptyComponent={
          hasError ? null : (
            <View className="mx-6 border border-dashed border-ds-outline-variant rounded-2xl p-8 items-center">
              <Text className="text-base font-barlow-semi text-ds-on-surface mb-1">No sessions yet</Text>
              <Text className="text-sm font-barlow text-ds-on-surface-variant text-center">
                Start a game from Home and your sessions will appear here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={null}
      />
    </SafeAreaView>
  );
}
