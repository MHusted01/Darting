import { useRouter } from 'expo-router';
import { DS_COLORS } from '@/constants/colors';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react-native';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do I add friends?',
    answer: 'Go to the Social tab and tap "Find". Search by name, @username, or email address to find players and send a friend request.',
  },
  {
    question: 'How do clubs work?',
    answer: 'Clubs are groups for dart players. Create your own club or search to join one. Club members share a leaderboard, game history, and can run tournaments together.',
  },
  {
    question: 'How does scoring work?',
    answer: 'Select a game type from the Home tab, add players, and follow the on-screen scoring prompts. Each game type has its own rules shown at setup.',
  },
  {
    question: 'How do I change my password?',
    answer: 'Go to Settings → Security. Enter your current password and your new password twice, then tap Update Password.',
  },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
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
        <Text className="text-xl font-barlow-condensed text-ds-on-surface">Help Center</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-6">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
            Frequently Asked Questions
          </Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
            {FAQ_ITEMS.map((item, index) => (
              <View
                key={item.question}
                className={index < FAQ_ITEMS.length - 1 ? 'border-b border-ds-outline-variant' : ''}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.question}
                  accessibilityState={{ expanded: openIndex === index }}
                  onPress={() => toggle(index)}
                  className="px-4 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <Text className="text-base font-barlow-semi text-ds-on-surface flex-1 pr-3">
                    {item.question}
                  </Text>
                  {openIndex === index
                    ? <ChevronDown size={18} color={DS_COLORS.outline} />
                    : <ChevronRight size={18} color={DS_COLORS.outline} />
                  }
                </Pressable>
                {openIndex === index && (
                  <View className="px-4 pb-4">
                    <Text className="text-sm font-barlow text-ds-on-surface-variant leading-relaxed">
                      {item.answer}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
