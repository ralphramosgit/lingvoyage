import { ArrowDownLeft, Lightbulb } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { phraseKey, playPhrase, SLOW_RATE, usePlayback } from '@/lib/audio';
import { colors, motion, radii, spacing } from '@/theme/theme';
import type { Phrase } from '@/types/api';

function SuggestionChip({
  phrase,
  onUse,
  onError,
}: {
  phrase: Phrase;
  onUse: () => void;
  onError: (message: string) => void;
}) {
  const { loadingKey, playingKey } = usePlayback();
  const key = phraseKey(phrase.hanzi.trim());
  const slowKey = phraseKey(phrase.hanzi.trim(), SLOW_RATE);
  const loading = loadingKey === key || loadingKey === slowKey;
  const playing = playingKey === key || playingKey === slowKey;

  const play = (slow: boolean) => {
    playPhrase(phrase.hanzi, { rate: slow ? SLOW_RATE : 1 }).catch((error: unknown) =>
      onError(errorMessage(error, "Couldn't play that phrase.")),
    );
  };

  return (
    <View style={[styles.chip, playing ? styles.chipPlaying : null]}>
      <PressableScale
        onPress={() => play(false)}
        onLongPress={() => play(true)}
        accessibilityRole="button"
        accessibilityLabel={`${phrase.english}. ${phrase.pinyin}`}
        accessibilityHint="Plays the phrase. Long-press to hear it slowly."
        style={styles.chipBody}>
        <View style={styles.hanziRow}>
          <Text variant="hanziSmall">{phrase.hanzi}</Text>
          {loading ? <ActivityIndicator size="small" color={colors.sky700} /> : null}
        </View>
        <Text variant="caption" color={colors.sky700}>
          {phrase.pinyin}
        </Text>
        <Text variant="tiny" color={colors.inkMuted} numberOfLines={2}>
          {phrase.english}
        </Text>
      </PressableScale>
      <IconButton
        icon={ArrowDownLeft}
        accessibilityLabel={`Use "${phrase.english}" in the text box`}
        onPress={onUse}
        size={32}
        iconSize={16}
        variant="tinted"
      />
    </View>
  );
}

export function SuggestionsRow({
  suggestions,
  onUse,
  onError,
}: {
  suggestions: Phrase[];
  onUse: (text: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(motion.base)} exiting={FadeOutDown.duration(motion.fast)} style={styles.wrapper}>
      <View style={styles.header}>
        <Lightbulb size={14} color="#A16207" />
        <Text variant="tiny" color={colors.inkMuted}>
          TRY SAYING
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}>
        {suggestions.map((phrase) => (
          <SuggestionChip key={phrase.hanzi} phrase={phrase} onUse={() => onUse(phrase.hanzi)} onError={onError} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm, paddingTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  scroll: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    maxWidth: 240,
    minWidth: 140,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + 2,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.sky100,
  },
  chipPlaying: { borderColor: colors.sky500, backgroundColor: colors.sky50 },
  chipBody: { flexShrink: 1, gap: 1, minHeight: 44, justifyContent: 'center' },
  hanziRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
