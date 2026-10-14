import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Default 0.97. */
  scaleTo?: number;
};

/** Pressable that gently scales down while pressed (skipped when Reduce Motion is on). */
export function PressableScale({ style, scaleTo = 0.97, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!reduceMotion) scale.set(withTiming(scaleTo, { duration: motion.fast }));
    onPressIn?.(event);
  };
  const handlePressOut = (event: GestureResponderEvent) => {
    scale.set(withTiming(1, { duration: motion.fast }));
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
