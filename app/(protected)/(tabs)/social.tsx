import { Alert, ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';

interface Club {
  id: string;
  name: string;
  league: string;
  nextMatch: string | null;
  isActive: boolean;
}

type FriendStatus = 'online' | 'in_match' | 'offline';

interface Friend {
  id: string;
  name: string;
  status: FriendStatus;
  activity: string;
  threeDartAvg: number;
}

const PLACEHOLDER_CLUBS: Club[] = [
  {
    id: '1',
    name: 'The Flight Club',
    league: 'Div 1 League',
    nextMatch: 'Tonight, 8:00 PM',
    isActive: true,
  },
  {
    id: '2',
    name: 'Pub Sharpshooters',
    league: 'Social League',
    nextMatch: 'Sat, 2:00 PM',
    isActive: false,
  },
];

const PLACEHOLDER_FRIENDS: Friend[] = [
  { id: '1', name: 'Mark Davies', status: 'online', activity: 'In Practice', threeDartAvg: 68.4 },
  { id: '2', name: 'Sarah Jenkins', status: 'in_match', activity: 'In a Match', threeDartAvg: 72.1 },
  { id: '3', name: 'Tom Hardy', status: 'offline', activity: 'Offline', threeDartAvg: 54.2 },
];

const STATUS_DOT: Record<Friend['status'], string> = {
  online:   'bg-ds-green-dark',
  in_match: 'bg-ds-red',
  offline:  'bg-ds-outline-variant',
};

const STATUS_TEXT: Record<Friend['status'], string> = {
  online:   'text-ds-on-surface-variant',
  in_match: 'text-ds-red',
  offline:  'text-ds-outline',
};

export default function SocialScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Text className="text-2xl font-barlow-condensed-xbold text-ds-on-surface tracking-tight">
          SOCIAL
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/(protected)/settings')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="active:opacity-70"
        >
          <Settings size={22} color="#444748" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6 pt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-2xl font-barlow-condensed text-ds-on-surface">My Clubs</Text>
            <Pressable
              className="bg-ds-red rounded-full px-4 py-2 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Create Club"
              onPress={() => Alert.alert('Coming Soon', 'Club creation will be available soon.')}
            >
              <Text className="text-white font-barlow-semi text-sm">+ Create Club</Text>
            </Pressable>
          </View>

          <View className="gap-3">
            {PLACEHOLDER_CLUBS.map((club) => (
              <View
                key={club.id}
                className="bg-ds-surface border border-ds-outline-variant rounded-xl p-4"
                style={club.isActive ? { borderLeftWidth: 4, borderLeftColor: '#1c1b1b' } : undefined}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View>
                    <Text className="text-base font-barlow-semi text-ds-on-surface">{club.name}</Text>
                    <Text className="text-sm font-barlow text-ds-on-surface-variant">{club.league}</Text>
                  </View>
                  {club.isActive && (
                    <View className="bg-ds-on-surface rounded-full px-3 py-1">
                      <Text className="text-white text-xs font-barlow-semi">ACTIVE</Text>
                    </View>
                  )}
                </View>
                <View className="bg-ds-surface-low rounded-lg px-3 py-2 flex-row items-center gap-2">
                  <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-wide">
                    Next Match
                  </Text>
                  <Text className="text-sm font-barlow-semi text-ds-on-surface">{club.nextMatch ?? 'No upcoming match'}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="px-6 pt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-2xl font-barlow-condensed text-ds-on-surface">Friends</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find friends"
              className="active:opacity-70"
              onPress={() => Alert.alert('Coming Soon', 'Finding friends will be available soon.')}
            >
              <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Find</Text>
            </Pressable>
          </View>

          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            {PLACEHOLDER_FRIENDS.map((friend, index) => (
              <View
                key={friend.id}
                className={`px-4 py-3 flex-row items-center gap-3 ${
                  index < PLACEHOLDER_FRIENDS.length - 1 ? 'border-b border-ds-outline-variant' : ''
                }`}
              >
                <View className="relative">
                  <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
                    <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">
                      {friend.name.split(' ').map((n) => n[0]).join('')}
                    </Text>
                  </View>
                  <View
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-ds-surface ${STATUS_DOT[friend.status]}`}
                  />
                </View>

                <View className="flex-1">
                  <Text className={`text-sm font-barlow-semi ${friend.status === 'offline' ? 'text-ds-outline' : 'text-ds-on-surface'}`}>
                    {friend.name}
                  </Text>
                  <Text className={`text-xs font-barlow ${STATUS_TEXT[friend.status]}`}>
                    {friend.activity}
                  </Text>
                </View>

                <View className="items-end">
                  <Text className={`text-xs font-barlow-semi uppercase tracking-wide ${friend.status === 'offline' ? 'text-ds-outline' : 'text-ds-on-surface-variant'}`}>
                    3-Dart Avg
                  </Text>
                  <Text className={`text-lg font-barlow-bold ${friend.status === 'offline' ? 'text-ds-outline' : 'text-ds-on-surface'}`}>
                    {friend.threeDartAvg.toFixed(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
