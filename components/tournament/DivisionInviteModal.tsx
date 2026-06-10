import { useEffect, useState } from 'react';
import { DS_COLORS } from '@/constants/colors';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSupabase } from '@/providers/SupabaseProvider';
import { searchClubsForDivision } from '@/lib/tournament-api';

interface DivisionInviteModalProps {
  divisionId: string;
  visible: boolean;
  onClose: () => void;
  onInvite: (clubId: string) => void;
  isInviting?: boolean;
}

export function DivisionInviteModal({ divisionId: _divisionId, visible, onClose, onInvite, isInviting }: DivisionInviteModalProps) {
  const supabase = useSupabase();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim() || !supabase) {
      setResults([]);
      return;
    }
    setIsFetching(true);
    searchClubsForDivision(supabase, debouncedQuery)
      .then(setResults)
      .catch((err: unknown) => Alert.alert('Error', err instanceof Error ? err.message : 'Search failed'))
      .finally(() => setIsFetching(false));
  }, [debouncedQuery, supabase]);

  function handleClose() {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View className="flex-1 bg-ds-bg">
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Invite Club</Text>
          <Pressable onPress={handleClose} className="active:opacity-70" accessibilityRole="button" accessibilityLabel="Cancel">
            <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Cancel</Text>
          </Pressable>
        </View>

        <View className="px-6 pt-4">
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 flex-row items-center">
            <TextInput
              className="flex-1 py-4 text-base font-barlow text-ds-on-surface"
              placeholder="Search clubs by name"
              placeholderTextColor={DS_COLORS.outline}
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search clubs"
            />
            {isFetching && <ActivityIndicator size="small" color={DS_COLORS.outline} />}
          </View>
        </View>

        <View className="px-6 mt-4">
          {results.map((club, idx) => (
            <Pressable
              key={club.id}
              onPress={() => { onInvite(club.id); handleClose(); }}
              disabled={isInviting}
              className={`px-4 py-4 flex-row items-center justify-between active:opacity-70 ${idx < results.length - 1 ? 'border-b border-ds-outline-variant' : ''}`}
              accessibilityRole="button"
              accessibilityLabel={`Invite ${club.name}`}
            >
              <Text className="text-base font-barlow text-ds-on-surface">{club.name}</Text>
              <Text className="text-sm font-barlow-semi text-ds-red">Invite</Text>
            </Pressable>
          ))}
          {!isFetching && debouncedQuery.trim() && results.length === 0 && (
            <Text className="text-sm font-barlow text-ds-outline text-center py-6">No clubs found</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
