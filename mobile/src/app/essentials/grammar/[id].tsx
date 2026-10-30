import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EntryList, EntrySpeakers, entryLabel } from '@/components/essentials/EntryRow';
import { EssentialsNotFound } from '@/components/essentials/EssentialsNotFound';
import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { Text } from '@/components/Text';
import { findGrammarPoint } from '@/content/essentials/grammar';
import { colors, radii, spacing } from '@/theme/theme';

export default function GrammarPointScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const point = findGrammarPoint(id);
  if (!point) return <EssentialsNotFound />;

  return (
    <EssentialsPage eyebrow="Grammar" title={point.title} backLabel="Back to Grammar">
      <View style={styles.pattern}>
        <View style={styles.patternText} accessible accessibilityLabel={`Pattern: ${entryLabel(point.pattern)}`}>
          <Text variant="tiny" color={colors.sky700}>
            THE PATTERN
          </Text>
          <Text variant="hanziLarge">{point.pattern.hanzi}</Text>
          <Text variant="label" color={colors.inkMuted}>
            {point.pattern.pinyin}
          </Text>
          <Text variant="bodyMedium">{point.pattern.english}</Text>
        </View>
        <EntrySpeakers entry={point.pattern} />
      </View>

      <Text variant="body">{point.explanation}</Text>

      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          Examples
        </Text>
        <EntryList entries={point.examples} />
      </View>
    </EssentialsPage>
  );
}

const styles = StyleSheet.create({
  pattern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.sky50,
    borderWidth: 1.5,
    borderColor: colors.sky100,
  },
  patternText: { flex: 1, flexShrink: 1, gap: 2 },
  section: { gap: spacing.md },
});
