import React from 'react';
import { DS_COLORS } from '@/constants/colors';
import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import AnimatedPressable from '@/components/ui/AnimatedPressable';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  message,
  ctaLabel,
  onCtaPress,
}: EmptyStateProps) {
  return (
    <View className="items-center px-6 py-10">
      <View accessible={false} className="w-16 h-16 rounded-full bg-ds-surface-low items-center justify-center mb-4">
        <Icon size={24} color={DS_COLORS.outline} />
      </View>
      <Text className="text-lg font-barlow-condensed text-ds-on-surface text-center">
        {title}
      </Text>
      {message ? (
        <Text className="text-sm font-barlow text-ds-on-surface-variant text-center mt-1">
          {message}
        </Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <AnimatedPressable
          testID="empty-state-cta"
          onPress={onCtaPress}
          haptic="light"
          accessibilityLabel={ctaLabel}
          className="bg-ds-red rounded-xl px-6 py-3 mt-5 active:opacity-70"
        >
          <Text className="text-ds-on-red text-sm font-barlow-semi">{ctaLabel}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
