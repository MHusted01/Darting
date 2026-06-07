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
import { useRouter } from 'expo-router';
import { useClubSearch, useJoinClub } from '@/hooks/useClubs';
import type { Club } from '@/types/social';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ClubSearchModal({ visible, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = useClubSearch(debouncedQuery);
  const joinClub = useJoinClub();

  function handleJoin(club: Club) {
    joinClub.mutate(club.id, {
      onSuccess: (result) => {
        if (result.alreadyMember) {
          handleClose();
          router.push(`/(protected)/club/${club.id}`);
        } else {
          Alert.alert('Joined!', `You've joined ${club.name}.`, [
            {
              text: 'View Club',
              onPress: () => {
                handleClose();
                router.push(`/(protected)/club/${club.id}`);
              },
            },
            { text: 'OK', onPress: handleClose },
          ]);
        }
      },
      onError: (err) => Alert.alert('Error', err.message),
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
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Find a Club</Text>
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
              placeholder="Search clubs by name"
              placeholderTextColor="#747878"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {isFetching && <ActivityIndicator size="small" color="#747878" />}
          </View>
        </View>

        {results && results.length > 0 && (
          <View className="px-6 pt-4">
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
              {results.map((club, index) => (
                <View
                  key={club.id}
                  className={`px-4 py-3 flex-row items-center gap-3 ${
                    index < results.length - 1 ? 'border-b border-ds-outline-variant' : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-barlow-semi text-ds-on-surface">{club.name}</Text>
                    {club.description && (
                      <Text className="text-xs font-barlow text-ds-on-surface-variant" numberOfLines={1}>
                        {club.description}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Join ${club.name}`}
                    className={`bg-ds-red rounded-lg px-3 py-2 active:opacity-70 ${joinClub.isPending ? 'opacity-50' : ''}`}
                    onPress={() => handleJoin(club)}
                    disabled={joinClub.isPending}
                  >
                    <Text className="text-xs font-barlow-semi text-white">Join</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {debouncedQuery.length >= 2 && !isFetching && results?.length === 0 && (
          <View className="px-6 pt-8 items-center">
            <Text className="text-sm font-barlow text-ds-outline">No clubs found for &quot;{debouncedQuery}&quot;</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
