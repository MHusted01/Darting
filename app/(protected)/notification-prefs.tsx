import { useRouter } from 'expo-router';
import { DS_COLORS } from '@/constants/colors';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '@/hooks/useNotificationPrefs';
import type { NotificationPrefs } from '@/lib/notificationPrefs';
import { DEFAULT_PREFS } from '@/lib/notificationPrefs';

interface PrefRow {
  key: keyof NotificationPrefs;
  label: string;
  accessibilityLabel: string;
}

const PREF_ROWS: PrefRow[] = [
  { key: 'friend_requests',    label: 'Friend Requests',    accessibilityLabel: 'Toggle friend requests notifications' },
  { key: 'club_invites',       label: 'Club Invites',       accessibilityLabel: 'Toggle club invites notifications' },
  { key: 'tournament_updates', label: 'Tournament Updates', accessibilityLabel: 'Toggle tournament updates notifications' },
  { key: 'match_challenges',   label: 'Match Challenges',   accessibilityLabel: 'Toggle match challenges notifications' },
];

export default function NotificationPrefsScreen() {
  const router = useRouter();
  const { data: prefs, isLoading } = useNotificationPrefs();
  const { mutate: updatePrefs } = useUpdateNotificationPrefs();

  const current = prefs ?? DEFAULT_PREFS;

  const handleToggle = (key: keyof NotificationPrefs, value: boolean) => {
    updatePrefs({ ...current, [key]: value }, {
      onError: (err) => Alert.alert(
        'Unable to save',
        err instanceof Error ? err.message : 'Could not update notification preferences',
      ),
    });
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
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Notification Preferences</Text>
      </View>

      <View className="px-6 pt-6">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
          Event Notifications
        </Text>

        {isLoading ? (
          <View className="gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </View>
        ) : (
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            {PREF_ROWS.map((row, index) => (
              <View
                key={row.key}
                className={`px-4 py-3 flex-row items-center justify-between ${
                  index < PREF_ROWS.length - 1 ? 'border-b border-ds-outline-variant' : ''
                }`}
              >
                <Text className="text-base font-barlow text-ds-on-surface">{row.label}</Text>
                <Switch
                  accessibilityLabel={row.accessibilityLabel}
                  value={current[row.key]}
                  onValueChange={(v) => handleToggle(row.key, v)}
                  trackColor={{ true: DS_COLORS.green, false: DS_COLORS.outlineVariant }}
                  thumbColor={DS_COLORS.surface}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
