import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
  className?: string;
  testID?: string;
}

export default function Skeleton({ className = '', testID = 'skeleton' }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 700 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View testID={testID} style={animatedStyle} accessible={false}>
      <View className={`bg-ds-surface-container rounded-lg ${className}`} />
    </Animated.View>
  );
}
