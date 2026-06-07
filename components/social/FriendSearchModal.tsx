import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSendFriendRequest, useUserSearch } from '@/hooks/useFriends';
import type { UserProfile } from '@/types/social';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function initials(user: UserProfile): string {
  const first = user.firstName?.[0] ?? '';
  const last  = user.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

function displayName(user: UserProfile): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
}

export function FriendSearchModal({ visible, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = useUserSearch(debouncedQuery);
  const sendRequest = useSendFriendRequest();

  function handleAdd(user: UserProfile) {
    sendRequest.mutate(user.id, {
      onSuccess: (result) => {
        if (result.alreadyRequested) {
          Alert.alert('Already sent', `A friend request to ${displayName(user)} is already pending.`);
        } else {
          Alert.alert('Request sent', `Friend request sent to ${displayName(user)}.`);
        }
      },
      onError: (err) => {
        Alert.alert('Error', err.message);
      },
    });
  }

  function handleClose() {
    setQuery('');
    setDebouncedQuery('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-ds-bg">
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Find Friends</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={handleClose}
            className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color="#444748" />
          </Pressable>
        </View>

        <View className="px-6 pt-4">
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 flex-row items-center">
            <TextInput
              className="flex-1 py-4 text-base font-barlow text-ds-on-surface"
              placeholder="Search by name or @username"
              placeholderTextColor="#747878"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isFetching && <ActivityIndicator size="small" color="#747878" />}
          </View>
        </View>

        {results && results.length > 0 && (
          <View className="px-6 pt-4">
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
              {results.map((user, index) => (
                <View
                  key={user.id}
                  className={`px-4 py-3 flex-row items-center gap-3 ${
                    index < results.length - 1 ? 'border-b border-ds-outline-variant' : ''
                  }`}
                >
                  <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
                    <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">
                      {initials(user)}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text className="text-sm font-barlow-semi text-ds-on-surface">
                      {displayName(user)}
                    </Text>
                    {user.username ? (
                      <Text className="text-xs font-barlow text-ds-on-surface-variant">@{user.username}</Text>
                    ) : null}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${displayName(user)} as friend`}
                    className="bg-ds-red rounded-lg px-3 py-2 active:opacity-70"
                    onPress={() => handleAdd(user)}
                    disabled={sendRequest.isPending}
                  >
                    <Text className="text-xs font-barlow-semi text-white">Add</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {debouncedQuery.length >= 2 && !isFetching && results?.length === 0 && (
          <View className="px-6 pt-8 items-center">
            <Text className="text-sm font-barlow text-ds-outline">No users found for &quot;{debouncedQuery}&quot;</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
