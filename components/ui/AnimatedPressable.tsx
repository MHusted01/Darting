import React, { useCallback } from 'react';
import { Pressable, PressableProps, GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { impact, notify, selection, ImpactStyle } from '@/lib/haptics';

export type HapticType = ImpactStyle | 'success' | 'selection';

interface AnimatedPressableProps extends PressableProps {
  haptic?: HapticType;
  className?: string;
}

function triggerHaptic(haptic: HapticType) {
  if (haptic === 'selection') {
    void selection();
  } else if (haptic === 'success') {
    void notify('success');
  } else {
    void impact(haptic);
  }
}

export default function AnimatedPressable({
  haptic,
  onPress,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      scale.value = withTiming(0.97, { duration: 100 });
      onPressIn?.(event);
    },
    [scale, onPressIn]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      scale.value = withTiming(1, { duration: 100 });
      onPressOut?.(event);
    },
    [scale, onPressOut]
  );

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (haptic) triggerHaptic(haptic);
      onPress?.(event);
    },
    [haptic, onPress]
  );

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...rest}
        accessibilityRole={rest.accessibilityRole ?? 'button'}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
