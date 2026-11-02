import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Sailboat } from '@/components/art/Sailboat';
import { Seagull } from '@/components/art/Seagull';
import { Waves } from '@/components/art/Waves';
import { colors, radii, spacing } from '@/theme/theme';

import { Text } from './Text';

/** Full-screen loading: the boat rocks on the waves while the seagull flaps overhead. */
export function VoyageLoader({ label = 'Setting sail…' }: { label?: string }) {
  const reduceMotion = useReducedMotion();
  const rock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    rock.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, rock]);

  const boat = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 + rock.get() * 6 }, { rotate: `${-5 + rock.get() * 10}deg` }],
  }));

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.scene}>
        <Seagull pose="fly" size={58} style={styles.gull} />
        <Animated.View style={[styles.boat, boat]}>
          <Sailboat size={64} />
        </Animated.View>
        <Waves color={colors.sky100} height={34} amplitude={5} duration={-2600} style={styles.backWave} />
        <Waves color="#BAE6FD" height={24} amplitude={5} duration={2000} />
      </View>
      <Text variant="label" color={colors.inkMuted} align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  scene: { width: 180, height: 150, borderRadius: radii.sheet, overflow: 'hidden' },
  gull: { position: 'absolute', top: 6, left: 92 },
  boat: { position: 'absolute', left: 50, bottom: 14 },
  backWave: { bottom: 6 },
});
