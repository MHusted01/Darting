import { Pressable, Text, View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';
import { useAcceptFriendRequest, useDeclineFriendRequest, usePendingRequests } from '@/hooks/useFriends';
import type { FriendRequest } from '@/types/social';

function initials(req: FriendRequest): string {
  const first = req.requester.firstName?.[0] ?? '';
  const last  = req.requester.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

function displayName(req: FriendRequest): string {
  return [req.requester.firstName, req.requester.lastName].filter(Boolean).join(' ') || 'Unknown';
}

export function FriendRequestsSection() {
  const { data: requests, isLoading } = usePendingRequests();
  const acceptMutation  = useAcceptFriendRequest();
  const declineMutation = useDeclineFriendRequest();

  if (isLoading) {
    return (
      <View className="py-4">
        <Skeleton className="h-14 w-full rounded-xl" />
      </View>
    );
  }

  if (!requests || requests.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
        Friend Requests
      </Text>
      <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
        {requests.map((req, index) => (
          <View
            key={req.id}
            className={`px-4 py-3 flex-row items-center gap-3 ${
              index < requests.length - 1 ? 'border-b border-ds-outline-variant' : ''
            }`}
          >
            <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
              <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">
                {initials(req)}
              </Text>
            </View>

            <Text className="flex-1 text-sm font-barlow-semi text-ds-on-surface">
              {displayName(req)}
            </Text>

            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decline friend request from ${displayName(req)}`}
                className={`border border-ds-outline-variant rounded-lg px-3 py-2 active:opacity-70 ${declineMutation.isPending ? 'opacity-50' : ''}`}
                onPress={() => declineMutation.mutate(req.id)}
                disabled={declineMutation.isPending}
              >
                <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">Decline</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Accept friend request from ${displayName(req)}`}
                className={`bg-ds-red rounded-lg px-3 py-2 active:opacity-70 ${acceptMutation.isPending ? 'opacity-50' : ''}`}
                onPress={() => acceptMutation.mutate(req.id)}
                disabled={acceptMutation.isPending}
              >
                <Text className="text-xs font-barlow-semi text-ds-on-red">Accept</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
