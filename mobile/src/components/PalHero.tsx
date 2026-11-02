import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { art } from '@/components/art/palette';
import { Sailboat } from '@/components/art/Sailboat';
import { PAL_NAME, Seagull } from '@/components/art/Seagull';
import { Waves } from '@/components/art/Waves';
import { colors, motion, radii, spacing } from '@/theme/theme';

import { Text } from './Text';

// What the pal says, one per tap.
const PHRASES = [
  { hanzi: '今天去哪儿？', pinyin: 'Jīntiān qù nǎr?', english: 'Where to today?' },
  { hanzi: '一路顺风！', pinyin: 'Yílù shùnfēng!', english: 'Have a good trip!' },
  { hanzi: '慢慢来。', pinyin: 'Mànmàn lái.', english: 'Take your time.' },
  { hanzi: '加油！', pinyin: 'Jiāyóu!', english: 'You can do it!' },
  { hanzi: '多少钱？', pinyin: 'Duōshao qián?', english: 'How much is it?' },
  { hanzi: '谢谢！', pinyin: 'Xièxie!', english: 'Thank you!' },
];

const HEIGHT = 228;

function Cloud({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.4} viewBox="0 0 60 24">
      <Path d="M0 22 C0 12 10 7 18 10 C21 1 37 -2 43 8 C51 4 62 10 60 22 Z" fill={art.cloud} />
    </Svg>
  );
}

/** The Encounters header: the seagull pal on a post at sea, greeting the learner with a phrase. Tap it for another. */
export function PalHero({ name }: { name: string }) {
  const reduceMotion = useReducedMotion();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const rock = useSharedValue(0);
  const drift = useSharedValue(0);
  const phrase = PHRASES[phraseIndex];

  useEffect(() => {
    if (reduceMotion) return;
    rock.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
    drift.set(withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [drift, reduceMotion, rock]);

  const boat = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 + rock.get() * 4 }, { rotate: `${-4 + rock.get() * 8}deg` }],
  }));
  const clouds = useAnimatedStyle(() => ({ transform: [{ translateX: -24 + drift.get() * 48 }] }));

  return (
    <View style={styles.hero}>
      <LinearGradient colors={[art.skyTop, art.skyLow]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, clouds]} pointerEvents="none">
        <View style={styles.cloudA}>
          <Cloud width={74} />
        </View>
        <View style={styles.cloudB}>
          <Cloud width={46} />
        </View>
      </Animated.View>

      <Waves color="#7DD3FC" height={58} amplitude={5} duration={-5200} />
      <Animated.View style={[styles.boat, boat]} pointerEvents="none">
        <Sailboat size={60} />
      </Animated.View>
      <Waves color={colors.sky500} height={40} amplitude={6} duration={3800} />

      <View style={styles.post} />
      <Seagull
        size={112}
        mood="happy"
        wave
        style={styles.gull}
        onPress={() => setPhraseIndex((index) => (index + 1) % PHRASES.length)}
        accessibilityLabel={`${PAL_NAME}, your seagull pal. Tap for another phrase.`}
      />

      <View style={styles.bubble}>
        <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
          Nǐ hǎo, {name}!
        </Text>
        <Animated.View key={phraseIndex} entering={reduceMotion ? undefined : FadeIn.duration(motion.base)} accessibilityLiveRegion="polite">
          <Text variant="hanzi" style={styles.hanzi}>
            {phrase.hanzi}
          </Text>
          <Text variant="caption" color={colors.sky700}>
            {phrase.pinyin}
          </Text>
          <Text variant="caption" color={colors.inkMuted}>
            {phrase.english}
          </Text>
        </Animated.View>
        <View style={styles.tail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: HEIGHT, borderRadius: radii.sheet, overflow: 'hidden', backgroundColor: art.skyLow },
  cloudA: { position: 'absolute', top: 18, right: 54 },
  cloudB: { position: 'absolute', top: 64, right: 8 },
  boat: { position: 'absolute', left: 22, bottom: 22 },
  post: {
    position: 'absolute',
    right: 44,
    bottom: 0,
    width: 30,
    height: 64,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: art.outline,
    backgroundColor: art.wood,
  },
  gull: { position: 'absolute', right: 3, bottom: 53 },
  bubble: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: 132,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    gap: 2,
  },
  hanzi: { marginTop: 2 },
  // A small square turned 45°, peeking out of the bubble's right edge toward the seagull.
  tail: {
    position: 'absolute',
    right: -6,
    top: 40,
    width: 14,
    height: 14,
    backgroundColor: colors.surface,
    transform: [{ rotate: '45deg' }],
  },
});
