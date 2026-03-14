import { useCallback, useEffect, useRef } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getHistoryData, type HistoryQuickStats, type HistorySessionItem } from '@/lib/history';

const STATUS_LABELS: Record<HistorySessionItem['status'], string> = {
  setup: 'Setup',
  in_progress: 'In Progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

const STATUS_STYLES: Record<
  HistorySessionItem['status'],
  { bg: string; text: string }
> = {
  setup: { bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { bg: 'bg-emerald-500', text: 'text-white' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-600' },
  abandoned: { bg: 'bg-red-500', text: 'text-white' },
};

const EMPTY_STATS: HistoryQuickStats = {
  gamesPlayed: 0,
  completedCount: 0,
  winRate: 0,
  inProgressSessions: 0,
  abandonedSessions: 0,
};

/**
 * Format a Date into a locale date string followed by a 2-digit hour:minute time.
 *
 * @param date - The Date to format
 * @returns The formatted string (locale date + space + `HH:MM` using two-digit hour and minute)
 */
function formatDateTime(date: Date): string {
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/**
 * Render the History screen showing quick stats and a list of past game sessions with refresh and navigation.
 *
 * Displays a header with aggregated statistics, a scrollable list of sessions, pull-to-refresh and retry-on-error controls, and navigates to the appropriate game screen when a session is opened.
 *
 * @returns The History screen component as a JSX element
 */
export default function HistoryScreen() {
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
      'History Error',
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

  const renderSessionRow = useCallback(
    ({ item }: { item: HistorySessionItem }) => {
      const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.abandoned;
      const statusLabel = STATUS_LABELS[item.status] ?? 'Unknown';

      return (
        <Pressable
          onPress={() => handleOpenSession(item)}
          className="border border-gray-200 rounded-xl p-4 bg-white active:opacity-70 mb-3"
          accessibilityRole="button"
          accessibilityLabel={`${item.gameName} ${statusLabel} session`}
        >
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-semibold text-black">{item.gameName}</Text>
              <Text className="text-sm text-gray-500">
                {item.playerCount} players • {formatDateTime(item.lastActivityAt)}
              </Text>
            </View>
            <View className={`rounded-full px-2.5 py-1 ${statusStyle.bg}`}>
              <Text className={`text-xs font-semibold ${statusStyle.text}`}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <Text className="text-sm text-gray-600">
            {item.status === 'completed'
              ? item.winnerName
                ? `Winner: ${item.winnerName}`
                : 'Completed (no winner recorded)'
              : item.status === 'in_progress'
                ? `Resume from round ${item.currentRound}`
                : item.status === 'abandoned'
                  ? 'Game was abandoned'
                  : 'Session setup not finished'}
          </Text>
        </Pressable>
      );
    },
    [handleOpenSession],
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center" edges={['top']}>
        <Text className="text-gray-400">Loading history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => `${item.sessionId}`}
        contentContainerClassName="px-6 pb-6"
        onRefresh={() => {
          void refetch();
        }}
        refreshing={refreshing}
        ListHeaderComponent={
          <View className="pt-4 pb-4">
            <Text className="text-3xl font-bold text-black mb-4">History</Text>

            <View className="border border-gray-200 rounded-xl p-4 bg-white">
              <Text className="text-sm text-gray-500 mb-3">Quick stats</Text>

              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <Text className="text-xl font-bold text-black">{quickStats.gamesPlayed}</Text>
                  <Text className="text-xs text-gray-500">Sessions</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-xl font-bold text-black">{quickStats.completedCount}</Text>
                  <Text className="text-xs text-gray-500">Completed</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-xl font-bold text-black">{quickStats.winRate}%</Text>
                  <Text className="text-xs text-gray-500">Completion</Text>
                </View>
              </View>

              <View className="flex-row justify-between mt-4 pt-4 border-t border-gray-100">
                <Text className="text-xs text-gray-500">
                  Active: {quickStats.inProgressSessions}
                </Text>
                <Text className="text-xs text-gray-500">
                  Abandoned: {quickStats.abandonedSessions}
                </Text>
              </View>
            </View>

            <Text className="text-sm font-semibold text-gray-500 mt-6 mb-2 uppercase tracking-wide">
              Sessions
            </Text>

          </View>
        }
        renderItem={renderSessionRow}
        ListEmptyComponent={
          hasError ? null : (
            <View className="border border-dashed border-gray-300 rounded-xl p-8 items-center">
              <Text className="text-base font-semibold text-black mb-1">No sessions yet</Text>
              <Text className="text-sm text-gray-500 text-center">
                Start a game from Home and your history will appear here.
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
