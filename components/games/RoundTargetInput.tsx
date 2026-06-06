import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { DartThrow } from '@/types/game';

interface RoundTargetInputProps {
  targetSegment: number;
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void;
}

type Multiplier = 1 | 2 | 3;

export function RoundTargetInput({
  targetSegment,
  isProcessing,
  onDartThrown,
}: RoundTargetInputProps) {
  const [pendingMultiplier, setPendingMultiplier] = useState(false);

  const throwDart = (multiplier: Multiplier) => {
    if (isProcessing) return;
    onDartThrown({ segment: targetSegment, multiplier });
    setPendingMultiplier(false);
  };

  const throwMiss = () => {
    if (isProcessing) return;
    onDartThrown({ segment: 0, multiplier: 0 });
  };

  if (pendingMultiplier) {
    return (
      <View className="gap-3">
        <Text className="text-center text-sm font-barlow text-ds-on-surface-variant">
          Multiplier for{' '}
          <Text className="font-barlow-semi text-ds-on-surface">{targetSegment}</Text>
        </Text>
        <View className="flex-row gap-2">
          {([1, 2, 3] as Multiplier[]).map((m) => {
            const labels = ['Single', 'Double', 'Triple'];
            const isRed = m === 2;
            return (
              <Pressable
                key={m}
                onPress={() => throwDart(m)}
                disabled={isProcessing}
                className={`flex-1 py-4 rounded-xl items-center active:opacity-70${isProcessing ? ' opacity-50' : ''} ${isRed ? 'bg-ds-red' : 'bg-ds-surface border border-ds-outline-variant'}`}
                accessibilityRole="button"
                accessibilityLabel={`${labels[m - 1]} ${targetSegment}`}
              >
                <Text
                  className={`text-base font-barlow-semi ${isRed ? 'text-white' : 'text-ds-on-surface'}`}
                >
                  {labels[m - 1]}
                </Text>
                <Text
                  className={`text-xs font-barlow mt-0.5 ${isRed ? 'text-white/80' : 'text-ds-on-surface-variant'}`}
                >
                  {targetSegment * m}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setPendingMultiplier(false)}
          disabled={isProcessing}
          className={`py-2 items-center active:opacity-70${isProcessing ? ' opacity-50' : ''}`}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text className="text-sm font-barlow text-ds-on-surface-variant">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => setPendingMultiplier(true)}
        disabled={isProcessing}
        className={`py-5 bg-ds-red rounded-xl items-center active:opacity-80${isProcessing ? ' opacity-50' : ''}`}
        accessibilityRole="button"
        accessibilityLabel={`Hit ${targetSegment}`}
      >
        <Text className="text-xl font-barlow-semi text-white">Hit {targetSegment}</Text>
      </Pressable>
      <Pressable
        onPress={throwMiss}
        disabled={isProcessing}
        className={`py-4 bg-ds-surface-low border border-ds-outline-variant rounded-xl items-center active:opacity-70${isProcessing ? ' opacity-50' : ''}`}
        accessibilityRole="button"
        accessibilityLabel="Miss"
      >
        <Text className="text-base font-barlow-semi text-ds-on-surface-variant">Miss</Text>
      </Pressable>
    </View>
  );
}
