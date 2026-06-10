import { useAuth, useUser } from '@clerk/expo';
import { DS_COLORS } from '@/constants/colors';
import { PROFILE_AVATAR_COLORS as AVATAR_COLORS } from '@/constants/avatarColors';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAppStore } from '@/stores/appStore';
import { useSupabase } from '@/providers/SupabaseProvider';
import { isValidUsername } from '@/lib/validation';
import { getErrorMessage } from '@/lib/errors';


export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { userId } = useAuth();
  const supabase = useSupabase();
  const { avatarColor, setAvatarColor } = useAppStore();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const displayInitials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || '?';

  const handleSave = async () => {
    if (isSaving) return;

    if (username && !isValidUsername(username)) {
      Alert.alert('Error', 'Username must be 3–20 characters: letters, numbers, underscores only.');
      return;
    }

    setIsSaving(true);
    try {
      if (username.toLowerCase() !== (user?.username ?? '').toLowerCase()) {
        const { data, error: lookupError } = await supabase
          .from('users')
          .select('id')
          .ilike('username', username)
          .neq('id', userId)
          .maybeSingle();

        if (lookupError) {
          Alert.alert('Error', lookupError.message);
          return;
        }
        if (data) {
          Alert.alert('Error', 'Username already taken');
          return;
        }
      }

      await user?.update({ firstName, lastName, username });
      Alert.alert('Saved', 'Your profile has been updated.');
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
          <ArrowLeft size={22} color={DS_COLORS.onSurface} />
        </Pressable>
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Personal Info</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-6 items-center">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: avatarColor }}
          >
            <Text className="text-2xl font-barlow-semi text-ds-on-surface">{displayInitials}</Text>
          </View>

          <View className="flex-row gap-3 mb-6">
            {AVATAR_COLORS.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={`${color} colour swatch`}
                onPress={() => setAvatarColor(color)}
                className="active:opacity-70"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: color,
                  borderWidth: avatarColor === color ? 3 : 1,
                  borderColor: avatarColor === color ? DS_COLORS.onSurface : DS_COLORS.outlineVariant,
                }}
              />
            ))}
          </View>
        </View>

        <View className="px-6 gap-4">
          <View>
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              First Name
            </Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={DS_COLORS.outline}
                accessibilityLabel="First name"
                className="py-4 text-base font-barlow text-ds-on-surface"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View>
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Last Name
            </Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={DS_COLORS.outline}
                accessibilityLabel="Last name"
                className="py-4 text-base font-barlow text-ds-on-surface"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View>
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
              Username
            </Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="@username"
                placeholderTextColor={DS_COLORS.outline}
                accessibilityLabel="Username"
                className="py-4 text-base font-barlow text-ds-on-surface"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save"
            accessibilityState={{ disabled: isSaving }}
            onPress={handleSave}
            disabled={isSaving}
            className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 mt-2 ${isSaving ? 'opacity-50' : ''}`}
          >
            <Text className="text-ds-on-red font-barlow-semi text-sm uppercase tracking-widest">
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
