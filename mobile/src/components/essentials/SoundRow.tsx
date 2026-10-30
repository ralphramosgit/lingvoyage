import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { Entry } from '@/content/essentials/types';
import { colors, radii, spacing } from '@/theme/theme';

import { EntrySpeakers, entryLabel } from './EntryRow';

/** A tone or a sound: a badge, how it sounds, and an example character to hear it in. */
export function SoundRow({
  badge,
  title,
  howItSounds,
  example,
  divider = false,
}: {
  badge: string;
  title?: string;
  howItSounds: string;
  example: Entry;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      <View style={styles.top}>
        <View style={styles.badge}>
          <Text variant="subheading" color={colors.sky700}>
            {badge}
          </Text>
        </View>
        <View style={styles.flex}>
          {title ? <Text variant="bodyStrong">{title}</Text> : null}
          <Text variant="body" color={title ? colors.inkMuted : colors.ink}>
            {howItSounds}
          </Text>
        </View>
      </View>
      <View style={styles.example}>
        <View style={styles.flex} accessible accessibilityLabel={`Example: ${entryLabel(example)}`}>
          <Text variant="hanziLarge">
            {example.hanzi}{' '}
            <Text variant="bodyStrong" color={colors.inkMuted}>
              {example.pinyin}
            </Text>
          </Text>
          <Text variant="caption">{example.english}</Text>
          {example.note ? (
            <Text variant="caption" color={colors.inkMuted} style={styles.note}>
              {example.note}
            </Text>
          ) : null}
        </View>
        <EntrySpeakers entry={example} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, flexShrink: 1 },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  badge: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.input,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.input,
    backgroundColor: colors.sky50,
  },
  note: { marginTop: 2 },
});
