import { View, Text, Pressable } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { getTargetLabel } from '@/lib/games/around-the-clock';
import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AroundTheClockInputProps {
  currentTarget: number;
  targetSegment: number;
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
  targetSegment,
  dartIndex,
  thrownDarts,
  onDartThrown,
  disabled = false,
}: AroundTheClockInputProps) {
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
                  ? 'bg-black'
                  : isThrown
                    ? wasHit
                      ? 'bg-emerald-500'
                      : 'bg-gray-300'
                    : 'bg-gray-200'
              }`}
            >
              {isThrown ? (
                wasHit ? (
                  <Check size={18} color="white" />
                ) : (
                  <X size={18} color="white" />
                )
              ) : (
                <Text
                  className={`text-sm font-bold ${
                    isCurrent ? 'text-white' : 'text-gray-500'
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
            className="bg-black rounded-xl py-5 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`Hit ${targetLabel}`}
          >
            <Text className="text-white text-lg font-bold">
              Hit {targetLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleMiss}
            className="border border-gray-300 rounded-xl py-5 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Miss"
          >
            <Text className="text-gray-600 text-lg font-bold">Miss</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
