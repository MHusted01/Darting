import { View, Text, Pressable } from 'react-native';
import { DS_COLORS } from '@/constants/colors';
import { Check, X } from 'lucide-react-native';
import { getTargetLabel, getTargetSegment } from '@/lib/games/around-the-clock';
import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AroundTheClockInputProps {
  currentTarget: number;
  dartIndex: number; // 0, 1, or 2
  thrownDarts: DartThrow[]; // darts thrown so far this turn
  onDartThrown: (dart: DartThrow) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AroundTheClockInput({
  currentTarget,
  dartIndex,
  thrownDarts,
  onDartThrown,
  disabled = false,
}: AroundTheClockInputProps) {
  const targetSegment = getTargetSegment(currentTarget);

  const handleHit = () => {
    if (disabled) return;
    onDartThrown({ segment: targetSegment, multiplier: 1 });
  };

  const handleMiss = () => {
    if (disabled) return;
    onDartThrown({ segment: 0, multiplier: 0 });
  };

  const targetLabel = getTargetLabel(currentTarget);

  return (
    <View className="gap-6">
      {/* Dart position indicators */}
      <View className="flex-row justify-center gap-3">
        {[0, 1, 2].map((i) => {
          const isThrown = i < thrownDarts.length;
          const isCurrent = i === dartIndex;
          const wasHit = isThrown && thrownDarts[i].segment > 0;

          return (
            <View
              key={i}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isCurrent
                  ? 'bg-ds-on-surface'
                  : isThrown
                    ? wasHit
                      ? 'bg-ds-green-dark'
                      : 'bg-ds-outline-variant'
                    : 'bg-ds-surface-container'
              }`}
            >
              {isThrown ? (
                wasHit ? (
                  <Check size={18} color={DS_COLORS.onRed} />
                ) : (
                  <X size={18} color={DS_COLORS.onRed} />
                )
              ) : (
                <Text
                  className={`text-sm font-barlow-bold ${
                    isCurrent ? 'text-ds-on-red' : 'text-ds-on-surface-variant'
                  }`}
                >
                  {i + 1}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Hit / Miss buttons */}
      {!disabled && dartIndex < 3 && (
        <View className="gap-3">
          <Pressable
            onPress={handleHit}
            className="bg-ds-on-surface rounded-xl py-5 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`Hit ${targetLabel}`}
          >
            <Text className="text-ds-on-red text-lg font-barlow-semi">
              Hit {targetLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleMiss}
            className="border border-ds-outline-variant rounded-xl py-5 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Miss"
          >
            <Text className="text-ds-on-surface-variant text-lg font-barlow-semi">Miss</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
