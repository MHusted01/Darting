import { useAuth, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useAppStore } from '@/stores/appStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, ExternalLink, ArrowLeft } from 'lucide-react-native';

const DS = {
  green: '#b8f0bc',
  outlineVariant: '#c4c7c7',
  surface: '#ffffff',
} as const;

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const { notifications, soundEffects, setNotifications, setSoundEffects } = useAppStore();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
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
            {[
              { label: 'Personal Info' },
              { label: 'Security' },
              { label: 'Subscription' },
            ].map((item, index, arr) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => Alert.alert('Coming Soon', `${item.label} settings will be available soon.`)}
                className={`px-4 py-4 flex-row items-center justify-between active:opacity-70 ${
                  index < arr.length - 1 ? 'border-b border-ds-outline-variant' : ''
                }`}
              >
                <Text className="text-base font-barlow text-ds-on-surface">{item.label}</Text>
                <ChevronRight size={18} color="#747878" />
              </Pressable>
            ))}
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
            <View className="px-4 py-3 flex-row items-center justify-between">
              <Text className="text-base font-barlow text-ds-on-surface">Sound Effects</Text>
              <Switch
                value={soundEffects}
                onValueChange={setSoundEffects}
                trackColor={{ true: DS.green, false: DS.outlineVariant }}
                thumbColor={DS.surface}
              />
            </View>
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
              onPress={() => Alert.alert('Coming Soon', 'Help Center will be available soon.')}
              className="px-4 py-4 flex-row items-center justify-between border-b border-ds-outline-variant active:opacity-70"
            >
              <Text className="text-base font-barlow text-ds-on-surface">Help Center</Text>
              <ChevronRight size={18} color="#747878" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Privacy Policy"
              onPress={() => Alert.alert('Coming Soon', 'Privacy Policy will be available soon.')}
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
      </ScrollView>
    </SafeAreaView>
  );
}
