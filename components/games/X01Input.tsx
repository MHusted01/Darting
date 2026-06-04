import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { DartThrow } from '@/types/game';

interface X01InputProps {
  onDartThrown: (dart: DartThrow) => void;
  isProcessing: boolean;
}

// Numbers 1–20 arranged in 4 rows of 5
const SEGMENT_ROWS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
] as const;

type Multiplier = 1 | 2 | 3;

export function X01Input({ onDartThrown, isProcessing }: X01InputProps) {
  const [pendingSegment, setPendingSegment] = useState<number | null>(null);

  const confirmDart = (multiplier: Multiplier) => {
    if (pendingSegment === null || isProcessing) return;
    onDartThrown({ segment: pendingSegment, multiplier });
    setPendingSegment(null);
  };

  const handleMiss = () => {
    if (isProcessing) return;
    setPendingSegment(null);
    onDartThrown({ segment: 0, multiplier: 0 });
  };

  if (pendingSegment !== null) {
    const isBull = pendingSegment === 25;
    const label = isBull ? 'Bull' : String(pendingSegment);

    return (
      <View className="gap-3">
        <Text className="text-center text-sm font-barlow text-ds-on-surface-variant">
          Multiplier for{' '}
          <Text className="font-barlow-semi text-ds-on-surface">{label}</Text>
        </Text>

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => confirmDart(1)}
            className="flex-1 py-4 bg-ds-surface border border-ds-outline-variant rounded-xl items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`Single ${label}`}
          >
            <Text className="text-base font-barlow-semi text-ds-on-surface">
              Single
            </Text>
            <Text className="text-xs font-barlow text-ds-on-surface-variant mt-0.5">
              {pendingSegment}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => confirmDart(2)}
            className="flex-1 py-4 bg-ds-red rounded-xl items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`Double ${label}`}
          >
            <Text className="text-base font-barlow-semi text-white">Double</Text>
            <Text className="text-xs font-barlow text-white/80 mt-0.5">
              {pendingSegment * 2}
            </Text>
          </Pressable>

          {!isBull && (
            <Pressable
              onPress={() => confirmDart(3)}
              className="flex-1 py-4 bg-ds-surface border border-ds-outline-variant rounded-xl items-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`Triple ${label}`}
            >
              <Text className="text-base font-barlow-semi text-ds-on-surface">
                Triple
              </Text>
              <Text className="text-xs font-barlow text-ds-on-surface-variant mt-0.5">
                {pendingSegment * 3}
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => setPendingSegment(null)}
          className="py-2 items-center active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text className="text-sm font-barlow text-ds-on-surface-variant">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {SEGMENT_ROWS.map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row gap-2">
          {row.map((segment) => (
            <Pressable
              key={segment}
              onPress={() => setPendingSegment(segment)}
              disabled={isProcessing}
              className="flex-1 h-11 bg-ds-surface border border-ds-outline-variant rounded-xl items-center justify-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`Segment ${segment}`}
            >
              <Text className="text-sm font-barlow-semi text-ds-on-surface">
                {segment}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}

      <View className="flex-row gap-2 mt-1">
        <Pressable
          onPress={() => setPendingSegment(25)}
          disabled={isProcessing}
          className="flex-1 h-11 bg-ds-surface border border-ds-outline-variant rounded-xl items-center justify-center active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Bull"
        >
          <Text className="text-sm font-barlow-semi text-ds-on-surface">Bull</Text>
        </Pressable>

        <Pressable
          onPress={handleMiss}
          disabled={isProcessing}
          className="flex-1 h-11 bg-ds-surface-low border border-ds-outline-variant rounded-xl items-center justify-center active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Miss"
        >
          <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">
            Miss
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
