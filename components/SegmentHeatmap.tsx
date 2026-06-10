import { Pressable, Text, View } from 'react-native';
import type { SegmentAccuracy, SegmentStat } from '@/lib/stats';
import { DS_COLORS } from '@/constants/colors';

interface SegmentHeatmapProps {
  accuracy: SegmentAccuracy;
  onSegmentPress?: (segment: string, stat: SegmentStat) => void;
}

function hexChannels(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const LOW = hexChannels(DS_COLORS.green);
const HIGH = hexChannels(DS_COLORS.greenDark);

function segmentColor(hitRate: number): string {
  if (hitRate === 0) return DS_COLORS.surfaceLow;
  const t = Math.min(hitRate / 0.7, 1);
  const r = Math.round(LOW[0] + t * (HIGH[0] - LOW[0]));
  const g = Math.round(LOW[1] + t * (HIGH[1] - LOW[1]));
  const b = Math.round(LOW[2] + t * (HIGH[2] - LOW[2]));
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
