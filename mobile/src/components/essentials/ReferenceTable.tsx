import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import type { Entry } from '@/content/essentials/types';
import { colors, spacing } from '@/theme/theme';

import { EntrySpeakers, entryLabel } from './EntryRow';

const SPEAKER_SIZE = 36;

/** React Native has no <table>, so this is View rows: character | pinyin | English | speakers. */
export function ReferenceTable({ rows }: { rows: Entry[] }) {
  return (
    <Card padded={false}>
      <View style={[styles.row, styles.headerRow]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.cells}>
          <Text variant="tiny" color={colors.inkMuted} style={styles.hanzi}>
            CHINESE
          </Text>
          <Text variant="tiny" color={colors.inkMuted} style={styles.cell}>
            PINYIN
          </Text>
          <Text variant="tiny" color={colors.inkMuted} style={styles.cell}>
            ENGLISH
          </Text>
        </View>
        <View style={styles.speakerColumn} />
      </View>
      {rows.map((row) => (
        <View key={`${row.hanzi}/${row.english}`} style={[styles.row, styles.divider]}>
          <View style={styles.cells} accessible accessibilityLabel={entryLabel(row)}>
            <Text variant="hanzi" style={styles.hanzi}>
              {row.hanzi}
            </Text>
            <Text variant="bodyMedium" color={colors.inkMuted} style={styles.cell}>
              {row.pinyin}
            </Text>
            <Text variant="bodyMedium" style={styles.cell}>
              {row.english}
            </Text>
          </View>
          <EntrySpeakers entry={row} size={SPEAKER_SIZE} />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerRow: { paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  cells: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hanzi: { width: 56 },
  cell: { flex: 1, flexShrink: 1 },
  // Lines the header up with the two speaker buttons below it.
  speakerColumn: { width: SPEAKER_SIZE * 2 + spacing.sm },
});
