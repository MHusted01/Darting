import { useAuth, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useAppStore } from '@/stores/appStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, ExternalLink, ArrowLeft } from 'lucide-react-native';
import { PRIVACY_POLICY_URL } from '@/constants/links';
import { useSupabase } from '@/providers/SupabaseProvider';

const DS = {
  green: '#b8f0bc',
  outlineVariant: '#c4c7c7',
  surface: '#ffffff',
} as const;

export default function SettingsScreen() {
  const { signOut, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const supabase = useSupabase();

  const { notifications, soundEffects, setNotifications, setSoundEffects } = useAppStore();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      if (userId) {
        const { error: tokenError } = await supabase.from('users').update({ push_token: null }).eq('id', userId);
        if (tokenError) {
          console.error('Failed to clear push token on sign-out:', tokenError.message);
        }
      }
      await signOut();
      router.replace('/(public)/sign-in');
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'errors' in err
          ? (err as { errors: { message: string }[] }).errors?.[0]?.message
          : undefined;
      Alert.alert('Error', msg ?? 'Something went wrong');
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Player';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

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
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-5">
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl p-4 flex-row items-center gap-4">
            <View className="w-14 h-14 rounded-full bg-ds-surface-low items-center justify-center">
              <Text className="text-xl font-barlow-semi text-ds-on-surface-variant">
                {displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-barlow-semi text-ds-on-surface">{displayName}</Text>
              <Text className="text-sm font-barlow text-ds-on-surface-variant">{email}</Text>
            </View>
          </View>
        </View>

        <View className="px-6 pt-6">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
            Account
          </Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Personal Info"
              onPress={() => router.push('/(protected)/personal-info')}
              className="px-4 py-4 flex-row items-center justify-between border-b border-ds-outline-variant active:opacity-70"
            >
              <Text className="text-base font-barlow text-ds-on-surface">Personal Info</Text>
              <ChevronRight size={18} color="#747878" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Security"
              onPress={() => router.push('/(protected)/security')}
              className="px-4 py-4 flex-row items-center justify-between border-b border-ds-outline-variant active:opacity-70"
            >
              <Text className="text-base font-barlow text-ds-on-surface">Security</Text>
              <ChevronRight size={18} color="#747878" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Subscription"
              onPress={() => Alert.alert('Coming Soon', 'Subscription settings will be available soon.')}
              className="px-4 py-4 flex-row items-center justify-between active:opacity-70"
            >
              <Text className="text-base font-barlow text-ds-on-surface">Subscription</Text>
              <ChevronRight size={18} color="#747878" />
            </Pressable>
          </View>
        </View>

        <View className="px-6 pt-6">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
            Preferences
          </Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-ds-outline-variant">
              <Text className="text-base font-barlow text-ds-on-surface">Notifications</Text>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ true: DS.green, false: DS.outlineVariant }}
                thumbColor={DS.surface}
              />
            </View>
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-ds-outline-variant">
              <Text className="text-base font-barlow text-ds-on-surface">Sound Effects</Text>
              <Switch
                value={soundEffects}
                onValueChange={setSoundEffects}
                trackColor={{ true: DS.green, false: DS.outlineVariant }}
                thumbColor={DS.surface}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notification Preferences"
              onPress={() => router.push('/(protected)/notification-prefs')}
              className="px-4 py-4 flex-row items-center justify-between active:opacity-70"
            >
              <Text className="text-base font-barlow text-ds-on-surface">Notification Preferences</Text>
              <ChevronRight size={18} color="#747878" />
            </Pressable>
          </View>
        </View>

        <View className="px-6 pt-6">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
            Support
          </Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Help Center"
              onPress={() => router.push('/(protected)/help-center')}
              className="px-4 py-4 flex-row items-center justify-between border-b border-ds-outline-variant active:opacity-70"
            >
              <Text className="text-base font-barlow text-ds-on-surface">Help Center</Text>
              <ChevronRight size={18} color="#747878" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Privacy Policy"
              onPress={() => {
                Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
                  Alert.alert('Could not open link', 'Please try again later.');
                });
              }}
              className="px-4 py-4 flex-row items-center justify-between active:opacity-70"
            >
              <Text className="text-base font-barlow text-ds-on-surface">Privacy Policy</Text>
              <ExternalLink size={18} color="#747878" />
            </Pressable>
          </View>
        </View>

        <View className="px-6 pt-8">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSigningOut ? 'Signing out' : 'Log out'}
            accessibilityState={{ disabled: isSigningOut }}
            onPress={handleSignOut}
            disabled={isSigningOut}
            className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${isSigningOut ? 'opacity-50' : ''}`}
          >
            <Text className="text-white font-barlow-semi text-sm uppercase tracking-widest">
              {isSigningOut ? 'Signing Out...' : 'Log Out'}
            </Text>
          </Pressable>
        </View>

        <View className="px-6 pt-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete Account"
            onPress={() => router.push('/(protected)/delete-account')}
            className="py-4 items-center active:opacity-70"
          >
            <Text className="text-ds-red font-barlow-semi text-sm">Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
