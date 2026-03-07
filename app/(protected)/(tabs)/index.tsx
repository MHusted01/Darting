import { SectionList, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GAME_SECTIONS } from '@/constants/games';
import { GameCard } from '@/components/GameCard';
import { GameSectionHeader } from '@/components/GameSectionHeader';

const ItemSeparator = () => <View className="h-3" />;

/**
 * Render the Home screen showing game sections and navigable game cards.
 *
 * The view displays a titled header ("Games") and a SectionList built from
 * GAME_SECTIONS. Each section renders a GameSectionHeader and GameCard items;
 * tapping a card navigates to `/game/{slug}`.
 *
 * @returns The Home screen React element containing the SectionList of games.
 */
export default function Home() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <SectionList
        sections={GAME_SECTIONS}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="pt-4 pb-2">
            <Text className="text-3xl font-bold text-black">Games</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <GameSectionHeader title={section.title} />
        )}
        renderItem={({ item }) => (
          <GameCard
            game={item}
            onPress={() => router.push(`/game/${item.slug}`)}
          />
        )}
        ItemSeparatorComponent={ItemSeparator}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
