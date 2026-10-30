import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EntryList } from '@/components/essentials/EntryRow';
import { EssentialsNotFound } from '@/components/essentials/EssentialsNotFound';
import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { Text } from '@/components/Text';
import { findCheatSheet } from '@/content/essentials/cheatsheets';
import { spacing } from '@/theme/theme';

export default function CheatSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sheet = findCheatSheet(id);
  if (!sheet) return <EssentialsNotFound />;

  return (
    <EssentialsPage eyebrow="Cheat sheet" title={sheet.title} subtitle={sheet.description} backLabel="Back to Cheat sheets">
      {sheet.groups.map((group) => (
        <View key={group.heading} style={styles.section}>
          <Text variant="heading" accessibilityRole="header">
            {group.heading}
          </Text>
          <EntryList entries={group.entries} />
        </View>
      ))}
    </EssentialsPage>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
});
