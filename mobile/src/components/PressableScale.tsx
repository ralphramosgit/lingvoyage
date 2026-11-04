import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { playSound, type SoundName } from '@/lib/sounds';
import { motion } from '@/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Default 0.97. */
  scaleTo?: number;
  /** Played on press. Default 'tap'; null when the press makes its own sound or plays the Chinese. */
  sound?: SoundName | null;
};

/** Pressable that gently scales down while pressed (skipped when Reduce Motion is on), with a tap sound. */
export function PressableScale({ style, scaleTo = 0.97, sound = 'tap', onPress, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
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
  const handlePress = (event: GestureResponderEvent) => {
    if (sound) playSound(sound);
    onPress?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPress={onPress ? handlePress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
