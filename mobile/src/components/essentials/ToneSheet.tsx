import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import type { ToneChar, ToneSlots } from '@/content/essentials/types';
import { withToneMark } from '@/lib/pinyin';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';

import { EntrySpeakers } from './EntryRow';
import { useAudioError, useAudioErrorMessage } from './EssentialsPage';
import { TONE_COLORS, ToneContour } from './ToneContour';

const TONE_NAMES = ['1st tone', '2nd tone', '3rd tone', '4th tone'] as const;

/** One syllable of the pinyin chart in all four tones, each with a character to hear it in. */
export function ToneSheet({
  syllable,
  tones,
  onClose,
  bottomInset,
}: {
  syllable: string;
  tones: ToneSlots;
  onClose: () => void;
  bottomInset: number;
}) {
  const onError = useAudioError();
  const audioError = useAudioErrorMessage();
  const used = tones.filter((slot): slot is ToneChar => slot !== null);

  // Android's back button closes the sheet rather than leaving the chart.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  return (
    <Animated.View exiting={FadeOut.duration(motion.fast)} style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(motion.base)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close the tones" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(motion.slow)} style={styles.sheetDock}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(bottomInset, spacing.lg) + spacing.sm }]}
          onAccessibilityEscape={onClose}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text variant="title" accessibilityRole="header">
                {syllable}
              </Text>
              <Text variant="caption" color={colors.inkMuted}>
                {used.length === 4 ? 'All four tones' : `${used.length} of the four tones are used in everyday words`}
              </Text>
            </View>
            {used.length > 1 ? (
              // One request for all of them: the voice pauses at each comma.
              <SpeakerButton
                text={used.map(([hanzi]) => hanzi).join('，')}
                label={`Play every tone of ${syllable}`}
                onError={onError}
              />
            ) : null}
            <IconButton icon={X} accessibilityLabel="Close the tones" onPress={onClose} />
          </View>
          {audioError ? <FormMessage message={audioError} /> : null}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {tones.map((slot, index) => (
              <ToneRow key={index} syllable={syllable} tone={(index + 1) as 1 | 2 | 3 | 4} slot={slot} divider={index > 0} />
            ))}
          </ScrollView>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function ToneRow({
  syllable,
  tone,
  slot,
  divider,
}: {
  syllable: string;
  tone: 1 | 2 | 3 | 4;
  slot: ToneChar | null;
  divider: boolean;
}) {
  const pinyin = withToneMark(syllable, tone);
  const name = TONE_NAMES[tone - 1];
  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      <ToneContour tone={tone} size={36} color={slot ? undefined : colors.line} />
      {slot ? (
        <>
          <View style={styles.flex} accessible accessibilityLabel={`${pinyin}, ${name}: ${slot[0]}, ${slot[1]}`}>
            <View style={styles.heading}>
              <Text variant="subheading" color={TONE_COLORS[tone]}>
                {pinyin}
              </Text>
              <Text variant="hanzi">{slot[0]}</Text>
            </View>
            <Text variant="caption" color={colors.inkMuted}>
              {slot[1]}
            </Text>
          </View>
          <EntrySpeakers entry={{ hanzi: slot[0], pinyin, english: pinyin }} size={36} />
        </>
      ) : (
        <View style={styles.flex} accessible accessibilityLabel={`${pinyin}, ${name}: no everyday word uses it`}>
          <Text variant="subheading" color={colors.inkMuted}>
            {pinyin}
          </Text>
          <Text variant="caption" color={colors.inkMuted}>
            No everyday word uses this tone.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, flexShrink: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,31,51,0.45)' },
  sheetDock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { marginTop: spacing.sm },
  listContent: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.card },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 68,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  heading: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
});
