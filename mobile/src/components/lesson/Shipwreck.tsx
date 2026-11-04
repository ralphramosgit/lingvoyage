import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, BookOpen, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { art } from '@/components/art/palette';
import { Sailboat } from '@/components/art/Sailboat';
import { PAL_NAME, Seagull, type SeagullPose } from '@/components/art/Seagull';
import { Waves } from '@/components/art/Waves';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';
import type { KeyPhrase } from '@/types/api';

const SCENE_HEIGHT = 200;
const BOAT = 88;
const GULL = 52;
/** When the seagull lets go of the deck and flies up. */
const TAKE_OFF_MS = 380;

function shipwreckSummary(reached: number, total: number) {
  const voyage = reached === 0 ? 'The hull gave out on the first question' : `You sailed through ${reached} of ${total} questions`;
  return `${voyage}, and ${PAL_NAME} flew to safety. Have a listen to what sank the boat, then set sail again.`;
}

/** A bubble rising from where the boat went down. */
function Bubble({ delay, offset, size }: { delay: number; offset: number; size: number }) {
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.set(withDelay(delay, withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), 4, false)));
  }, [delay, rise]);

  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.get() === 0 ? 0 : 1 - rise.get(),
    transform: [{ translateY: -rise.get() * 46 }],
  }));

  return (
    <Animated.View
      style={[styles.bubble, { marginLeft: offset, width: size, height: size, borderRadius: size / 2 }, riseStyle]}
    />
  );
}

/** The boat lurches and goes under, the seagull flies up off the deck, and bubbles come up. */
function SinkingScene() {
  const reduceMotion = useReducedMotion();
  // With Reduce Motion on, it opens on the end: the sea, and the seagull in the air.
  const [pose, setPose] = useState<SeagullPose>(reduceMotion ? 'fly' : 'stand');
  const sink = useSharedValue(0);
  const lurch = useSharedValue(0);
  const lift = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    lurch.set(withSequence(withTiming(-1, { duration: 140 }), withTiming(1, { duration: 200 }), withTiming(0.6, { duration: 160 })));
    sink.set(withDelay(300, withTiming(1, { duration: 1700, easing: Easing.in(Easing.quad) })));
    lift.set(withDelay(TAKE_OFF_MS, withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.4)) })));
    const timer = setTimeout(() => setPose('fly'), TAKE_OFF_MS);
    return () => clearTimeout(timer);
  }, [lift, lurch, reduceMotion, sink]);

  const boat = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() * (BOAT + 30) }, { rotate: `${lurch.get() * 10 + sink.get() * 28}deg` }],
  }));
  const gull = useAnimatedStyle(() => ({
    transform: [{ translateX: lift.get() * 34 }, { translateY: -lift.get() * 80 }],
  }));

  return (
    <View style={styles.scene} accessible accessibilityLabel={`The boat sinks, and ${PAL_NAME} flies up to safety.`}>
      <LinearGradient colors={[art.skyTop, art.skyLow]} style={StyleSheet.absoluteFill} />
      <Waves color="#7DD3FC" height={62} amplitude={5} duration={-5200} />
      {reduceMotion ? null : (
        <>
          <Animated.View style={[styles.boat, boat]}>
            <Sailboat size={BOAT} />
          </Animated.View>
          <Bubble delay={900} offset={-14} size={10} />
          <Bubble delay={1250} offset={6} size={7} />
          <Bubble delay={1600} offset={-4} size={12} />
        </>
      )}
      <Waves color={colors.sky500} height={42} amplitude={6} duration={3800} />
      <Animated.View style={[styles.gull, gull]}>
        <Seagull size={GULL} pose={pose} mood="worried" />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(motion.base).delay(reduceMotion ? 0 : 1500)} style={styles.speech}>
        <Text variant="hanzi">加油！</Text>
        <Text variant="caption" color={colors.sky700}>
          Jiāyóu!
        </Text>
        <Text variant="caption" color={colors.inkMuted}>
          You can do it!
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Challenge mode's end when the hull runs out: the boat sinks, then the Chinese that sank it, each
 * with a play button, and Retry (a full hull, with the missed questions first).
 */
export function Shipwreck({
  reached,
  total,
  wrecks,
  bottomInset,
  exitHint,
  onAudioError,
  onRetry,
  onReview,
  onExit,
}: {
  /** Questions finished before it sank. */
  reached: number;
  total: number;
  wrecks: KeyPhrase[];
  bottomInset: number;
  exitHint: string;
  onAudioError: (message: string) => void;
  onRetry: () => void;
  /** Back to the learn step first. Lessons only: checkpoints and quizzes have none. */
  onReview?: () => void;
  onExit: () => void;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.column, styles.body, { paddingBottom: bottomInset + spacing.xl }]}
      showsVerticalScrollIndicator={false}>
      <SinkingScene />

      <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)} style={styles.text}>
        <Text variant="title" align="center" accessibilityRole="header">
          The boat sank!
        </Text>
        <Text variant="body" align="center" color={colors.inkMuted}>
          {shipwreckSummary(reached, total)}
        </Text>
      </Animated.View>

      {wrecks.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 2)} style={styles.review}>
          <Text variant="tiny" color={colors.inkMuted} accessibilityRole="header">
            WHAT SANK THE BOAT
          </Text>
          <Card padded={false}>
            {wrecks.map((phrase, index) => (
              <View key={phrase.hanzi} style={[styles.wreck, index > 0 ? styles.divider : null]}>
                <View style={styles.flex}>
                  <Text variant="hanzi">{phrase.hanzi}</Text>
                  <Text variant="label" color={colors.inkMuted}>
                    {phrase.pinyin}
                  </Text>
                  <Text variant="caption">{phrase.english}</Text>
                </View>
                <SpeakerButton text={phrase.hanzi} label={`Play ${phrase.english}`} onError={onAudioError} />
              </View>
            ))}
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 3)} style={styles.actions}>
        <Button
          label="Retry"
          icon={RotateCcw}
          onPress={onRetry}
          accessibilityHint="Sets sail again with a full hull, starting with the questions you missed"
        />
        {onReview ? (
          <Button
            label="Review the lesson first"
            icon={BookOpen}
            variant="secondary"
            onPress={onReview}
            accessibilityHint="Goes back to the learn step, then the questions with a full hull"
          />
        ) : null}
        <Button label="Leave for now" icon={ArrowLeft} variant="ghost" size="md" onPress={onExit} accessibilityHint={exitHint} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  body: { gap: spacing.xxl, paddingTop: spacing.xl },
  scene: { height: SCENE_HEIGHT, borderRadius: radii.sheet, overflow: 'hidden', backgroundColor: art.skyLow },
  boat: { position: 'absolute', left: '50%', bottom: 26, marginLeft: -BOAT / 2 },
  bubble: {
    position: 'absolute',
    left: '50%',
    bottom: 34,
    borderWidth: 1.5,
    borderColor: art.white,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  // Starts on the boat's deck.
  gull: { position: 'absolute', left: '50%', bottom: 49, marginLeft: -GULL / 2 + 6 },
  speech: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  text: { gap: spacing.sm },
  review: { gap: spacing.sm },
  wreck: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  actions: { gap: spacing.sm },
});
