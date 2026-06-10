import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';
import { useRouter } from 'expo-router';
import { useFriendsActivity } from '@/hooks/useFriendsActivity';
import { timeAgo } from '@/lib/time';
import type { FriendActivityItem } from '@/types/social';

function ActivityRow({ item }: { item: FriendActivityItem }) {
  const router = useRouter();
  const authorName =
    [item.author.firstName, item.author.lastName].filter(Boolean).join(' ') ||
    item.author.username ||
    'Someone';
  const initials =
    ((item.author.firstName?.[0] ?? '') + (item.author.lastName?.[0] ?? '')).toUpperCase() ||
    item.author.username?.[0]?.toUpperCase() ||
    '?';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${authorName}'s profile`}
      onPress={() => router.push(`/(protected)/friend/${item.author.id}` as never)}
      className="px-4 py-3 flex-row items-center gap-3 active:opacity-70 border-b border-ds-outline-variant"
    >
      <View className="w-9 h-9 rounded-full bg-ds-surface-low items-center justify-center">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">{initials}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-barlow-semi text-ds-on-surface" numberOfLines={1}>
          {authorName}
        </Text>
        <Text className="text-xs font-barlow text-ds-on-surface-variant capitalize" numberOfLines={1}>
          {item.gameSlug.replace(/-/g, ' ')}
          {item.isWinner ? ' · Won' : ''}
          {item.threeDartAvg != null ? ` · ${item.threeDartAvg.toFixed(1)} avg` : ''}
        </Text>
      </View>
      <Text className="text-xs font-barlow text-ds-outline">{timeAgo(item.completedAt)}</Text>
    </Pressable>
  );
}

export function FriendActivitySection() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useFriendsActivity();

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return (
      <View className="px-6 pt-4 pb-2">
        <Text className="text-2xl font-barlow-condensed text-ds-on-surface mb-3">Activity</Text>
        <View className="gap-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View className="px-6 pt-4">
      <Text className="text-2xl font-barlow-condensed text-ds-on-surface mb-3">Activity</Text>
      <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
        {items.map((item) => (
          <ActivityRow key={`${item.sessionId}-${item.author.id}`} item={item} />
        ))}
        {hasNextPage && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load more activity"
            onPress={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-3 items-center active:opacity-70 border-t border-ds-outline-variant"
          >
            {isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#ba1a1a" />
            ) : (
              <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Show more</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
