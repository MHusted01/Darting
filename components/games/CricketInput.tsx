import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CRICKET_SEGMENTS, getSegmentLabel } from '@/lib/games/cricket';
import type { CricketSegment } from '@/lib/games/cricket';
import type { DartThrow } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CricketInputProps {
  dartIndex: number; // 0, 1, or 2
  thrownDarts: DartThrow[]; // darts thrown so far this turn
  onDartThrown: (dart: DartThrow) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
/**
 * Produce a short display label for a DartThrow.
 *
 * @param dart - The thrown dart; `segment === 0` or `multiplier === 0` represent a miss, and `segment === 25` represents the bull.
 * @returns `Miss` for a miss; otherwise a prefix `S`, `D`, or `T` followed by the segment number or `B` for bull (e.g., `S20`, `D5`, `T19`, `SB`, `DB`).
 */

function getDartLabel(dart: DartThrow): string {
  if (dart.segment === 0 || dart.multiplier === 0) return 'Miss';
  const prefix = dart.multiplier === 3 ? 'T' : dart.multiplier === 2 ? 'D' : 'S';
  const seg = dart.segment === 25 ? 'B' : String(dart.segment);
  return `${prefix}${seg}`;
}

// ---------------------------------------------------------------------------
// Component
/**
 * Render an interactive three-dart cricket input UI for selecting segments, multipliers, and misses.
 *
 * @param dartIndex - The active dart position (0–2) for this turn.
 * @param thrownDarts - Array of previously thrown darts for the current turn used to display status and labels.
 * @param onDartThrown - Callback invoked with a `DartThrow` object `{ segment, multiplier }` when a throw or miss is confirmed.
 * @param disabled - When `true`, interaction is disabled and the input area is hidden.
 * @returns The JSX tree that renders the cricket input controls and per-dart status indicators.
 */

export function CricketInput({
  dartIndex,
  thrownDarts,
  onDartThrown,
  disabled = false,
}: CricketInputProps) {
  const [selectedSegment, setSelectedSegment] = useState<CricketSegment | null>(null);

  const handleSegmentPress = (segment: CricketSegment) => {
    if (disabled) return;
    setSelectedSegment(segment);
  };

  const handleMultiplierPress = (multiplier: number) => {
    if (disabled || selectedSegment === null) return;
    onDartThrown({ segment: selectedSegment, multiplier });
    setSelectedSegment(null);
  };

  const handleMiss = () => {
    if (disabled) return;
    onDartThrown({ segment: 0, multiplier: 0 });
    setSelectedSegment(null);
  };

  const handleBack = () => {
    setSelectedSegment(null);
  };

  // Multiplier options for the selected segment
  const multiplierOptions =
    selectedSegment === 25
      ? [
          { label: 'Single Bull', value: 1 },
          { label: 'Double Bull', value: 2 },
        ]
      : [
          { label: 'Single', value: 1 },
          { label: 'Double', value: 2 },
          { label: 'Triple', value: 3 },
        ];

  return (
    <View className="gap-6">
      {/* Dart position indicators */}
      <View className="flex-row justify-center gap-3">
        {[0, 1, 2].map((i) => {
          const isThrown = i < thrownDarts.length;
          const isCurrent = i === dartIndex;
          const wasHit =
            isThrown && thrownDarts[i].segment > 0 && thrownDarts[i].multiplier > 0;

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
                <Text className="text-white text-xs font-bold">
                  {getDartLabel(thrownDarts[i])}
                </Text>
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

      {/* Input area */}
      {!disabled && dartIndex < 3 && (
        <View className="gap-3">
          {selectedSegment === null ? (
            <>
              {/* Segment selection grid: 2x3 for 15-20, full width for Bull */}
              <View className="flex-row flex-wrap gap-3">
                {CRICKET_SEGMENTS.filter((s) => s !== 25).map((segment) => (
                  <Pressable
                    key={segment}
                    onPress={() => handleSegmentPress(segment)}
                    className="bg-black rounded-xl py-4 items-center active:opacity-70"
                    style={{ width: '48%' }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${getSegmentLabel(segment)}`}
                  >
                    <Text className="text-white text-lg font-bold">
                      {getSegmentLabel(segment)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Bull button - full width */}
              <Pressable
                onPress={() => handleSegmentPress(25)}
                className="bg-black rounded-xl py-4 items-center active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Select Bull"
              >
                <Text className="text-white text-lg font-bold">Bull</Text>
              </Pressable>

              {/* Miss button */}
              <Pressable
                onPress={handleMiss}
                className="border border-gray-300 rounded-xl py-4 items-center active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Miss"
              >
                <Text className="text-gray-600 text-lg font-bold">Miss</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Multiplier selection */}
              <Text className="text-center text-sm text-gray-500 mb-1">
                {getSegmentLabel(selectedSegment)} — choose multiplier
              </Text>

              {multiplierOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => handleMultiplierPress(opt.value)}
                  className="bg-black rounded-xl py-4 items-center active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  <Text className="text-white text-lg font-bold">{opt.label}</Text>
                </Pressable>
              ))}

              {/* Back button */}
              <Pressable
                onPress={handleBack}
                className="border border-gray-300 rounded-xl py-4 items-center active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Go back to segment selection"
              >
                <Text className="text-gray-600 text-lg font-bold">Back</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}
