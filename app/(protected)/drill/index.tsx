import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { DRILLS } from '@/constants/drills';
import DrillCatalogueItem from '@/components/DrillCatalogueItem';

export default function DrillCatalogueScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" className="active:opacity-70">
          <ArrowLeft size={22} color="#1c1b1b" />
        </Pressable>
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Drills</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-6 pt-6">
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            {DRILLS.map((drill, i) => (
              <Animated.View key={drill.slug} entering={FadeInDown.duration(200).delay(Math.min(i, 8) * 40)}>
              <DrillCatalogueItem
                name={drill.name}
                description={drill.description}
                benchmarkTarget={drill.benchmarkTarget}
                isLast={i === DRILLS.length - 1}
                onPress={() => router.push(`/drill/${drill.slug}`)}
              />
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
