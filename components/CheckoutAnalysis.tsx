import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CheckoutSummary, DoubleEntry } from '@/lib/stats';

interface CheckoutAnalysisProps {
  summary: CheckoutSummary | null;
}

function DoubleRow({ entry }: { entry: DoubleEntry }) {
  const pct = Math.round(entry.rate * 100);
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm font-barlow-semi text-ds-on-surface">D{entry.segment}</Text>
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-barlow text-ds-on-surface-variant">
          {entry.successes}/{entry.attempts}
        </Text>
        <Text className="text-sm font-barlow-semi text-ds-on-surface w-10 text-right">
          {pct}%
        </Text>
      </View>
    </View>
  );
}

export default function CheckoutAnalysis({ summary }: CheckoutAnalysisProps) {
  const router = useRouter();

  if (!summary || summary.totalAttempts === 0) {
    return (
      <View className="items-center py-4">
        <Text className="text-sm font-barlow text-ds-on-surface-variant">No checkout data yet</Text>
      </View>
    );
  }

  const overallPct = Math.round(summary.overallRate * 100);

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest">
          Overall
        </Text>
        <Text testID="checkout-overall-rate" className="text-2xl font-barlow-bold text-ds-on-surface">{overallPct}%</Text>
      </View>

      {summary.bestDoubles.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
            Best closers
          </Text>
          {summary.bestDoubles.map((entry) => (
            <DoubleRow key={entry.segment} entry={entry} />
          ))}
        </View>
      )}

      {summary.worstDoubles.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
            Needs work
          </Text>
          {summary.worstDoubles.map((entry) => (
            <DoubleRow key={entry.segment} entry={entry} />
          ))}
          <Pressable
            onPress={() => router.push('/drill/practice-doubles')}
            className="mt-2 flex-row items-center active:opacity-70"
          >
            <Text className="text-xs font-barlow-semi text-ds-red">Practice doubles</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
