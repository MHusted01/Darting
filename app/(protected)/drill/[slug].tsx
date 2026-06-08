import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Target } from 'lucide-react-native';
import { DRILL_MAP } from '@/constants/drills';

export default function DrillDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const drill = DRILL_MAP.get(slug ?? '');

  if (!drill) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
        <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <ArrowLeft size={22} color="#1c1b1b" />
          </Pressable>
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Drill</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-barlow-semi text-ds-on-surface mb-2">Drill not found</Text>
          <Text className="text-sm font-barlow text-ds-on-surface-variant text-center">
            This drill does not exist or has been removed.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <ArrowLeft size={22} color="#1c1b1b" />
        </Pressable>
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Drill</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-6 pt-6">
          <View className="w-12 h-12 rounded-full bg-ds-red-container items-center justify-center mb-4">
            <Target size={22} color="#ba1a1a" />
          </View>
          <Text className="text-2xl font-barlow-condensed text-ds-on-surface mb-1">{drill.name}</Text>
          <Text className="text-base font-barlow text-ds-on-surface-variant mb-6">{drill.description}</Text>

          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-4">
            <View className="px-4 pt-4 pb-2 border-b border-ds-outline-variant">
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest">
                How to score
              </Text>
            </View>
            <View className="px-4 py-4">
              <Text className="text-sm font-barlow text-ds-on-surface leading-relaxed">{drill.howToScore}</Text>
            </View>
          </View>

          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            <View className="px-4 pt-4 pb-2 border-b border-ds-outline-variant">
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest">
                Benchmark target
              </Text>
            </View>
            <View className="px-4 py-4">
              <Text className="text-2xl font-barlow-bold text-ds-on-surface">{drill.benchmarkTarget}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
