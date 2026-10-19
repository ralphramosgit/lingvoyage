import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LogoMark } from '@/components/LogoMark';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, layout, motion, spacing } from '@/theme/theme';

export default function WelcomeScreen() {
  return (
    <LinearGradient colors={['#38BDF8', colors.sky500, colors.sky600]} locations={[0, 0.45, 1]} style={styles.flex}>
      <StatusBar style="light" />
      {/* Soft background shapes */}
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.column}>
          <View style={styles.hero}>
            <Animated.View entering={FadeInDown.duration(motion.slow)}>
              <LogoMark size={96} />
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
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  blobTop: { width: 320, height: 320, top: -120, right: -100 },
  blobBottom: { width: 260, height: 260, bottom: 80, left: -140 },
});
