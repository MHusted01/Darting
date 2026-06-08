import { useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, TriangleAlert } from 'lucide-react-native';
import { getErrorMessage } from '@/lib/errors';

const CONFIRM_PHRASE = 'DELETE';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [input, setInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = input === CONFIRM_PHRASE;

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting || !user) return;

    setIsDeleting(true);
    try {
      await user.delete();
      router.replace('/(public)/sign-in');
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="active:opacity-70"
        >
          <ArrowLeft size={22} color="#1c1b1b" />
        </Pressable>
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Delete Account</Text>
      </View>

      <View className="px-6 pt-8 gap-6">
        <View className="bg-ds-red-container border border-ds-red rounded-xl p-4 flex-row gap-3 items-start">
          <TriangleAlert size={20} color="#ba1a1a" />
          <Text className="text-sm font-barlow text-ds-on-surface flex-1 leading-relaxed">
            This will permanently delete your account and all associated data. This action cannot be undone.
          </Text>
        </View>

        <View>
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
            Type DELETE to confirm
          </Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="DELETE"
              placeholderTextColor="#747878"
              accessibilityLabel="Type DELETE to confirm account deletion"
              className="py-4 text-base font-barlow text-ds-on-surface"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm delete account"
          accessibilityState={{ disabled: !isConfirmed || isDeleting }}
          onPress={handleDelete}
          disabled={!isConfirmed || isDeleting}
          className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${!isConfirmed || isDeleting ? 'opacity-50' : ''}`}
        >
          <Text className="text-white font-barlow-semi text-sm uppercase tracking-widest">
            {isDeleting ? 'Deleting...' : 'Delete My Account'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
