import { Pressable, Text, View } from 'react-native';
import type { SegmentAccuracy, SegmentStat } from '@/lib/stats';

interface SegmentHeatmapProps {
  accuracy: SegmentAccuracy;
  onSegmentPress?: (segment: string, stat: SegmentStat) => void;
}

// Interpolate between ds-green (#b8f0bc) at low hit rate and ds-green-dark (#1e502a) at high.
// When hit rate is 0 (no data) use ds-surface-low (#f7f3f2).
function segmentColor(hitRate: number): string {
  if (hitRate === 0) return '#f7f3f2';
  const t = Math.min(hitRate / 0.7, 1);
  const r = Math.round(0xb8 + t * (0x1e - 0xb8));
  const g = Math.round(0xf0 + t * (0x50 - 0xf0));
  const b = Math.round(0xbc + t * (0x2a - 0xbc));
  return `rgb(${r},${g},${b})`;
}

const ROWS: number[][] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
];

export default function SegmentHeatmap({ accuracy, onSegmentPress }: SegmentHeatmapProps) {
  const emptyStat: SegmentStat = { singles: 0, doubles: 0, triples: 0, throwShare: 0 };

  return (
    <View className="gap-1.5">
      {ROWS.map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row gap-1.5">
          {row.map((num) => {
            const key = String(num);
            const stat = accuracy[key] ?? emptyStat;
            return (
              <Pressable
                key={key}
                testID={`segment-${num}`}
                onPress={() => onSegmentPress?.(key, stat)}
                className="flex-1 rounded-lg items-center justify-center py-3 active:opacity-70"
                style={{ backgroundColor: segmentColor(stat.throwShare) }}
                accessibilityRole="button"
                accessibilityLabel={`Segment ${num}`}
              >
                <Text className="text-xs font-barlow-semi text-ds-on-surface">{num}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Bull row */}
      {(() => {
        const bullStat = accuracy['25'] ?? emptyStat;
        return (
          <Pressable
            testID="segment-25"
            onPress={() => onSegmentPress?.('25', bullStat)}
            className="rounded-lg items-center justify-center py-3 active:opacity-70"
            style={{ backgroundColor: segmentColor(bullStat.throwShare) }}
            accessibilityRole="button"
            accessibilityLabel="Bull segment"
          >
            <Text className="text-xs font-barlow-semi text-ds-on-surface">Bull</Text>
          </Pressable>
        );
      })()}
    </View>
  );
}
