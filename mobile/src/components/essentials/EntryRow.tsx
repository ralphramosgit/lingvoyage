import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import type { Entry } from '@/content/essentials/types';
import { colors, spacing } from '@/theme/theme';

import { useAudioError } from './EssentialsPage';

export function entryLabel(entry: Entry) {
  return `${entry.hanzi}, ${entry.pinyin}, ${entry.english}${entry.note ? `. ${entry.note}` : ''}`;
}

/** Slow and normal speed buttons for one entry. Only plays on tap: nothing preloads. */
export function EntrySpeakers({ entry, size = 40 }: { entry: Entry; size?: number }) {
  const onError = useAudioError();
  const text = entry.audio ?? entry.hanzi;
  return (
    <View style={styles.speakers}>
      <SpeakerButton text={text} slow label={`Play slowly: ${entry.english}`} size={size} onError={onError} />
      <SpeakerButton text={text} label={`Play: ${entry.english}`} size={size} onError={onError} />
    </View>
  );
}

/** Hanzi, pinyin and English stacked, with the speakers on the right. Long text wraps. */
export function EntryRow({ entry, divider = false, large = false }: { entry: Entry; divider?: boolean; large?: boolean }) {
  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      {/* Grouped so a screen reader reads the entry in one go; the speakers stay separate buttons. */}
      <View style={styles.text} accessible accessibilityLabel={entryLabel(entry)}>
        <Text variant={large ? 'hanziLarge' : 'hanzi'}>{entry.hanzi}</Text>
        <Text variant="label" color={colors.inkMuted}>
          {entry.pinyin}
        </Text>
        <Text variant="bodyMedium">{entry.english}</Text>
        {entry.note ? (
          <Text variant="caption" color={colors.inkMuted} style={styles.note}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <EntrySpeakers entry={entry} />
    </View>
  );
}

/** A card of entries separated by dividers. */
export function EntryList({ entries, large = false }: { entries: Entry[]; large?: boolean }) {
  return (
    <Card padded={false}>
      {entries.map((entry, index) => (
        <EntryRow key={`${entry.hanzi}/${entry.english}`} entry={entry} divider={index > 0} large={large} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  text: { flex: 1, flexShrink: 1 },
  note: { marginTop: 2 },
  speakers: { flexDirection: 'row', gap: spacing.sm },
});
