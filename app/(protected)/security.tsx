import { useSession, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { getErrorMessage } from '@/lib/errors';

export default function SecurityScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const lastSignIn = session?.lastActiveAt
    ? session.lastActiveAt.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  const handleSave = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await user?.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: false,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsSaving(false);
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
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Security</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-6">
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-4 mb-6">
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
              Last sign-in
            </Text>
            <Text className="text-base font-barlow text-ds-on-surface">{lastSignIn}</Text>
          </View>

          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
            Change Password
          </Text>

          <View className="gap-3">
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor="#747878"
                accessibilityLabel="Current password"
                secureTextEntry
                className="py-4 text-base font-barlow text-ds-on-surface"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor="#747878"
                accessibilityLabel="New password"
                secureTextEntry
                className="py-4 text-base font-barlow text-ds-on-surface"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#747878"
                accessibilityLabel="Confirm new password"
                secureTextEntry
                className="py-4 text-base font-barlow text-ds-on-surface"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save password"
              accessibilityState={{ disabled: isSaving }}
              onPress={handleSave}
              disabled={isSaving}
              className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 mt-2 ${isSaving ? 'opacity-50' : ''}`}
            >
              <Text className="text-white font-barlow-semi text-sm uppercase tracking-widest">
                {isSaving ? 'Saving...' : 'Update Password'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
