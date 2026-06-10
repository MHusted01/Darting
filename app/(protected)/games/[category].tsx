import { useEffect, useRef } from 'react';
import { FlatList, Text, View, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Dices } from 'lucide-react-native';
import { GAMES, IMPLEMENTED_SLUGS, type GameCategory } from '@/constants/games';
import EmptyState from '@/components/ui/EmptyState';
import { GameCard } from '@/components/GameCard';

const CATEGORY_LABELS: Record<string, string> = {
  Classic: 'Real Game',
  Practice: 'Practice',
  Party: 'Party',
};

const VALID_CATEGORIES = new Set<string>(['Classic', 'Practice', 'Party']);

export default function GameCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();

  const safeCategory = category && VALID_CATEGORIES.has(category) ? category : null;
  const games = safeCategory
    ? GAMES.filter((g) => g.category === (safeCategory as GameCategory))
    : [];
  const label = CATEGORY_LABELS[safeCategory ?? ''] ?? 'Games';

  const hasAnimatedRows = useRef(false);
  useEffect(() => {
    hasAnimatedRows.current = true;
  }, []);

  const handlePress = (slug: string) => {
    if (!IMPLEMENTED_SLUGS.has(slug)) return;
    router.push(`/game/${slug}`);
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
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">{label}</Text>
      </View>

      <FlatList
        data={games}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={Dices}
            title="No games here"
            message="This category has no games yet."
            ctaLabel="Go back"
            onCtaPress={() => router.back()}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={
              hasAnimatedRows.current ? undefined : FadeInDown.duration(200).delay(Math.min(index, 8) * 40)
            }
          >
            <View className={!IMPLEMENTED_SLUGS.has(item.slug) ? 'opacity-40' : ''}>
              <GameCard
                game={item}
                onPress={() => handlePress(item.slug)}
              />
            </View>
          </Animated.View>
        )}
      />
    </SafeAreaView>
  );
}
