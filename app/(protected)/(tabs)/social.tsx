import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useMyClubs } from '@/hooks/useClubs';
import { useFriends, useRemoveFriend } from '@/hooks/useFriends';
import { usePresence } from '@/hooks/usePresence';
import { mergePresence } from '@/lib/friends';
import { FriendRequestsSection } from '@/components/social/FriendRequestsSection';
import { FriendSearchModal } from '@/components/social/FriendSearchModal';
import { CreateClubModal } from '@/components/social/CreateClubModal';
import { ClubSearchModal } from '@/components/social/ClubSearchModal';
import type { Club, Friend, FriendStatus } from '@/types/social';

const STATUS_DOT: Record<FriendStatus, string> = {
  online:   'bg-ds-green-dark',
  in_match: 'bg-ds-red',
  offline:  'bg-ds-outline-variant',
};

const STATUS_TEXT: Record<FriendStatus, string> = {
  online:   'text-ds-on-surface-variant',
  in_match: 'text-ds-red',
  offline:  'text-ds-outline',
};

function friendActivity(status: FriendStatus): string {
  if (status === 'online')   return 'Online';
  if (status === 'in_match') return 'In a Match';
  return 'Offline';
}

function friendInitials(friend: Friend): string {
  const first = friend.firstName?.[0] ?? '';
  const last  = friend.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

export default function SocialScreen() {
  const router = useRouter();
  const [friendSearchVisible, setFriendSearchVisible] = useState(false);
  const [createClubVisible,   setCreateClubVisible]   = useState(false);
  const [clubSearchVisible,   setClubSearchVisible]   = useState(false);

  const clubsQuery    = useMyClubs();
  const friendsQuery  = useFriends();
  const { presenceMap } = usePresence();
  const removeFriendMutation = useRemoveFriend();

  const friends = mergePresence(friendsQuery.data ?? [], presenceMap);

  const refetchedOnFocus = useRef(false);
  const refetchClubs   = clubsQuery.refetch;
  const refetchFriends = friendsQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!refetchedOnFocus.current) {
        refetchedOnFocus.current = true;
        return;
      }
      void refetchClubs();
      void refetchFriends();
    }, [refetchClubs, refetchFriends]),
  );

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Text className="text-2xl font-barlow-condensed-xbold text-ds-on-surface tracking-tight">
          SOCIAL
        </Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── My Clubs ── */}
        <View className="px-6 pt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-2xl font-barlow-condensed text-ds-on-surface">My Clubs</Text>
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Find a club"
                className="border border-ds-outline-variant rounded-full px-4 py-2 active:opacity-70"
                onPress={() => setClubSearchVisible(true)}
              >
                <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Find</Text>
              </Pressable>
              <Pressable
                className="bg-ds-red rounded-full px-4 py-2 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Create Club"
                onPress={() => setCreateClubVisible(true)}
              >
                <Text className="text-white font-barlow-semi text-sm">+ Create</Text>
              </Pressable>
            </View>
          </View>

          {clubsQuery.isLoading && (
            <ActivityIndicator size="small" color="#ba1a1a" />
          )}

          {!clubsQuery.isLoading && (!clubsQuery.data || clubsQuery.data.length === 0) && (
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl p-6 items-center">
              <Text className="text-sm font-barlow text-ds-outline text-center">
                You&apos;re not in any clubs yet.{'\n'}Create one or search to join.
              </Text>
            </View>
          )}

          {clubsQuery.data && clubsQuery.data.length > 0 && (
            <View className="gap-3">
              {clubsQuery.data.map((club: Club) => (
                <Pressable
                  key={club.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${club.name}`}
                  onPress={() => router.push(`/(protected)/club/${club.id}`)}
                  className="bg-ds-surface border border-ds-outline-variant rounded-xl p-4 active:opacity-80"
                  style={club.role === 'admin' ? { borderLeftWidth: 4, borderLeftColor: '#1c1b1b' } : undefined}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-barlow-semi text-ds-on-surface">{club.name}</Text>
                      {club.description && (
                        <Text className="text-sm font-barlow text-ds-on-surface-variant" numberOfLines={1}>
                          {club.description}
                        </Text>
                      )}
                    </View>
                    {club.role === 'admin' && (
                      <View className="bg-ds-on-surface rounded-full px-3 py-1 ml-2">
                        <Text className="text-white text-xs font-barlow-semi">ADMIN</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Friends ── */}
        <View className="px-6 pt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-2xl font-barlow-condensed text-ds-on-surface">Friends</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find friends"
              className="border border-ds-outline-variant rounded-full px-4 py-2 active:opacity-70"
              onPress={() => setFriendSearchVisible(true)}
            >
              <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Find</Text>
            </Pressable>
          </View>

          <FriendRequestsSection />

          {friendsQuery.isLoading && (
            <ActivityIndicator size="small" color="#ba1a1a" />
          )}

          {!friendsQuery.isLoading && (!friends || friends.length === 0) && (
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl p-6 items-center">
              <Text className="text-sm font-barlow text-ds-outline text-center">
                No friends yet.{'\n'}Search to add friends.
              </Text>
            </View>
          )}

          {friends.length > 0 && (
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
              {friends.map((friend: Friend, index: number) => {
                const confirmRemoveFriend = () => {
                  const name = [friend.firstName, friend.lastName].filter(Boolean).join(' ') || 'this friend';
                  Alert.alert(
                    'Remove Friend',
                    `Remove ${name} from friends?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => removeFriendMutation.mutate(friend.friendshipId, {
                          onError: (err) => Alert.alert('Remove failed', err instanceof Error ? err.message : 'Could not remove friend'),
                        }),
                      },
                    ],
                  );
                };
                return (
                <Pressable
                  key={friend.friendshipId}
                  accessibilityRole="button"
                  accessibilityLabel={`${[friend.firstName, friend.lastName].filter(Boolean).join(' ')} friend row`}
                  accessibilityHint="Press or long press to remove this friend"
                  onPress={confirmRemoveFriend}
                  onLongPress={confirmRemoveFriend}
                  className={`px-4 py-3 flex-row items-center gap-3 active:opacity-70 ${
                    index < friends.length - 1 ? 'border-b border-ds-outline-variant' : ''
                  }`}
                >
                  <View className="relative">
                    <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
                      <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">
                        {friendInitials(friend)}
                      </Text>
                    </View>
                    <View
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-ds-surface ${STATUS_DOT[friend.status]}`}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className={`text-sm font-barlow-semi ${friend.status === 'offline' ? 'text-ds-outline' : 'text-ds-on-surface'}`}>
                      {[friend.firstName, friend.lastName].filter(Boolean).join(' ') || 'Unknown'}
                    </Text>
                    <Text className={`text-xs font-barlow ${STATUS_TEXT[friend.status]}`}>
                      {friendActivity(friend.status)}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className={`text-xs font-barlow-semi uppercase tracking-wide ${friend.status === 'offline' ? 'text-ds-outline' : 'text-ds-on-surface-variant'}`}>
                      3-Dart Avg
                    </Text>
                    <Text className={`text-lg font-barlow-bold ${friend.status === 'offline' ? 'text-ds-outline' : 'text-ds-on-surface'}`}>
                      {friend.threeDartAvg != null ? friend.threeDartAvg.toFixed(1) : '—'}
                    </Text>
                  </View>
                </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <FriendSearchModal visible={friendSearchVisible} onClose={() => setFriendSearchVisible(false)} />
      <CreateClubModal   visible={createClubVisible}   onClose={() => setCreateClubVisible(false)} />
      <ClubSearchModal   visible={clubSearchVisible}    onClose={() => setClubSearchVisible(false)} />
    </SafeAreaView>
  );
}
