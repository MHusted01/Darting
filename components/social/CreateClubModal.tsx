import { useState } from 'react';
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
import { useCreateClub } from '@/hooks/useClubs';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CreateClubModal({ visible, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const router = useRouter();
  const createClub = useCreateClub();

  function handleClose() {
    setName('');
    setDescription('');
    onClose();
  }

  function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a club name.');
      return;
    }

    createClub.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: (club) => {
          handleClose();
          router.push(`/(protected)/club/${club.id}`);
        },
        onError: (err) => {
          Alert.alert('Error', err.message);
        },
      },
    );
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
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Create Club</Text>
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

        <View className="px-6 pt-6 gap-4">
          <View>
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Club Name
            </Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                className="py-4 text-base font-barlow text-ds-on-surface"
                placeholder="e.g. The Flight Club"
                placeholderTextColor="#747878"
                value={name}
                onChangeText={setName}
                maxLength={60}
              />
            </View>
          </View>

          <View>
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Description (optional)
            </Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                className="py-4 text-base font-barlow text-ds-on-surface"
                placeholder="What's this club about?"
                placeholderTextColor="#747878"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create club"
            className={`rounded-xl py-4 items-center active:opacity-70 ${
              name.trim() ? 'bg-ds-red' : 'bg-ds-surface-container'
            }`}
            onPress={handleCreate}
            disabled={createClub.isPending || !name.trim()}
          >
            {createClub.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className={`text-base font-barlow-semi ${name.trim() ? 'text-white' : 'text-ds-outline'}`}>
                Create Club
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
