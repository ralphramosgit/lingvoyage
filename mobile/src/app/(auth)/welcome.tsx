import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sailboat } from '@/components/art/Sailboat';
import { Seagull } from '@/components/art/Seagull';
import { SeagullFlyBy } from '@/components/art/SeagullFlyBy';
import { Waves } from '@/components/art/Waves';
import { Button } from '@/components/Button';
import { LogoMark } from '@/components/LogoMark';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, layout, motion, spacing } from '@/theme/theme';

export default function WelcomeScreen() {
  const reduceMotion = useReducedMotion();
  const rock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    rock.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, rock]);

  const boat = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 + rock.get() * 6 }, { rotate: `${-5 + rock.get() * 10}deg` }],
  }));

  return (
    <LinearGradient colors={['#38BDF8', colors.sky500, colors.sky600]} locations={[0, 0.45, 1]} style={styles.flex}>
      <StatusBar style="light" />
      <SeagullFlyBy top={120} size={44} delay={1200} every={5200} duration={4200} />

      {/* The sea along the bottom, with the boat riding it. */}
      <Waves color="rgba(255,255,255,0.12)" height={190} amplitude={8} duration={-7000} />
      <Animated.View style={[styles.boat, boat]} pointerEvents="none">
        <Sailboat size={72} />
      </Animated.View>
      <Waves color="rgba(255,255,255,0.16)" height={132} amplitude={7} duration={5200} />
      <Waves color="rgba(2,132,199,0.45)" height={72} amplitude={6} duration={-4000} />

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.column}>
          <View style={styles.hero}>
            <Animated.View entering={FadeInDown.duration(motion.slow)}>
              <LogoMark size={96} />
              {/* The pal, perched on the logo's top edge. */}
              <Seagull size={78} mood="happy" wave style={styles.perched} />
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(motion.slow).delay(80)} style={styles.titles}>
              <Text variant="display" color="#FFFFFF" align="center" accessibilityRole="header">
                Lingvoyage
              </Text>
              <Text variant="heading" color="#FFFFFF" align="center">
                Speak your way around the world.
              </Text>
              <Text variant="body" color="rgba(255,255,255,0.88)" align="center" style={styles.lead}>
                Practice real travel conversations in Mandarin before you land.
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.duration(motion.slow).delay(220)} style={styles.actions}>
            <Button
              label="Get started"
              variant="sun"
              icon={ArrowRight}
              iconPosition="right"
              onPress={() => router.push('/sign-up')}
            />
            <Animated.View entering={FadeIn.duration(motion.slow).delay(320)}>
              <PressableScale
                onPress={() => router.push('/sign-in')}
                accessibilityRole="button"
                accessibilityLabel="I already have an account"
                style={styles.textButton}>
                <Text variant="bodyStrong" color="#FFFFFF">
                  I already have an account
                </Text>
              </PressableScale>
            </Animated.View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xxl },
  titles: { alignItems: 'center', gap: spacing.sm },
  lead: { maxWidth: 320, marginTop: spacing.xs },
  actions: { gap: spacing.sm },
  textButton: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  // Feet (at 90% of its height) on the tile's top edge.
  perched: { position: 'absolute', top: -70, right: -20 },
  // Rides the back wave, above the buttons.
  boat: { position: 'absolute', bottom: 166, left: 28 },
});
