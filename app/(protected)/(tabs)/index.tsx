import { ScrollView, Text, View, Pressable } from 'react-native';
import { DS_COLORS } from '@/constants/colors';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings, Play, Target, PartyPopper, ChevronRight } from 'lucide-react-native';
import { useUser } from '@clerk/expo';

type ModeCard = {
  category: string;
  label: string;
  subtitle: string;
  bg: string;
  textColor: string;
  subtitleColor: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  iconBg: string;
  iconColor: string;
};

const MODE_CARDS: ModeCard[] = [
  {
    category: 'Classic',
    label: 'Real Game',
    subtitle: 'Ranked 501 & Cricket tracking',
    bg: 'bg-ds-red',
    textColor: 'text-ds-on-red',
    subtitleColor: 'text-ds-on-red/80',
    Icon: Play,
    iconBg: 'bg-white/20',
    iconColor: DS_COLORS.onRed,
  },
  {
    category: 'Practice',
    label: 'Practice',
    subtitle: 'Warmups and skill drills',
    bg: 'bg-ds-surface',
    textColor: 'text-ds-on-surface',
    subtitleColor: 'text-ds-on-surface-variant',
    Icon: Target,
    iconBg: 'bg-ds-surface-low',
    iconColor: DS_COLORS.onSurfaceVariant,
  },
  {
    category: 'Party',
    label: 'Party',
    subtitle: 'Casual games for groups',
    bg: 'bg-ds-green',
    textColor: 'text-ds-green-dark',
    subtitleColor: 'text-ds-green-dark/80',
    Icon: PartyPopper,
    iconBg: 'bg-white/40',
    iconColor: DS_COLORS.greenDark,
  },
];

function HomeScreen() {
  const router = useRouter();
  const { user } = useUser();

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('');

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Text className="text-2xl font-barlow-condensed-xbold text-ds-on-surface tracking-tight">
          DARTING
        </Text>
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-full bg-ds-surface-low items-center justify-center">
            <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">{initials || '?'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/(protected)/settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="active:opacity-70"
          >
            <Settings size={22} color={DS_COLORS.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6 pt-6 pb-4">
          <Text className="text-4xl font-barlow-condensed-xbold text-ds-on-surface leading-tight">Step Up</Text>
          <Text className="text-base font-barlow text-ds-on-surface-variant mt-1">Select your game mode</Text>
        </View>

        <View className="px-6 gap-4">
          {MODE_CARDS.map((card) => {
            const Icon = card.Icon;
            return (
              <AnimatedPressable
                key={card.category}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`${card.label} - ${card.subtitle}`}
                className={`${card.bg} rounded-2xl p-5 active:opacity-80`}
                style={{ minHeight: 140 }}
                onPress={() => router.push(`/(protected)/games/${card.category}`)}
              >
                <View className={`w-11 h-11 rounded-full ${card.iconBg} items-center justify-center mb-auto`}>
                  <Icon size={22} color={card.iconColor} />
                </View>
                <View className="mt-6 flex-row items-end justify-between">
                  <View>
                    <Text className={`text-2xl font-barlow-condensed ${card.textColor}`}>{card.label}</Text>
                    <Text className={`text-sm font-barlow mt-0.5 ${card.subtitleColor}`}>{card.subtitle}</Text>
                  </View>
                  <ChevronRight size={20} color={card.iconColor} />
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

export default withErrorBoundary(HomeScreen, 'home');
