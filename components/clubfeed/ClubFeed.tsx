import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useClubFeed, useDeletePost, useSetReaction } from '@/hooks/useClubFeed';
import type { ClubPost, ReactionType } from '@/types/social';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';

interface Props {
  clubId: string;
  isAdmin: boolean;
}

export function ClubFeed({ clubId, isAdmin }: Props) {
  const [composerVisible, setComposerVisible] = useState(false);
  const { userId } = useAuth();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useClubFeed(clubId);
  const deletePost = useDeletePost(clubId);
  const setReaction = useSetReaction(clubId);

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  function handleReact(postId: string, type: ReactionType, isActive: boolean) {
    setReaction.mutate({ postId, type, isActive });
  }

  function handleDelete(postId: string) {
    deletePost.mutate(postId);
  }

  return (
    <View className="flex-1">
      <FlatList
        data={posts}
        keyExtractor={(item: ClubPost) => item.id}
        renderItem={({ item }: { item: ClubPost }) => (
          <PostCard
            post={item}
            clubId={clubId}
            currentUserId={userId ?? ''}
            isAdmin={isAdmin}
            onReact={handleReact}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.3}
        onRefresh={refetch}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? (
            <View className="py-16 items-center">
              <ActivityIndicator color="#ba1a1a" />
            </View>
          ) : (
            <View className="py-16 px-8 items-center gap-2">
              <Text className="text-base font-barlow-condensed text-ds-on-surface">No posts yet</Text>
              <Text className="text-sm font-barlow text-ds-outline text-center">
                Be the first to share something with the club!
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color="#ba1a1a" style={{ paddingVertical: 16 }} /> : null
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create new post"
        onPress={() => setComposerVisible(true)}
        className="absolute bottom-6 right-6 bg-ds-red rounded-full w-14 h-14 items-center justify-center shadow-sm active:opacity-70"
        style={{ elevation: 4 }}
      >
        <Text className="text-white text-2xl font-barlow-semi leading-none">+</Text>
      </Pressable>

      <PostComposer
        visible={composerVisible}
        clubId={clubId}
        onClose={() => setComposerVisible(false)}
      />
    </View>
  );
}
