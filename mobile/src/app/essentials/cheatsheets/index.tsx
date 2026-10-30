import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { SectionCard } from '@/components/essentials/SectionCard';
import { CHEAT_SHEETS } from '@/content/essentials/cheatsheets';
import { spacing } from '@/theme/theme';

export default function CheatSheetsScreen() {
  return (
    <EssentialsPage
      eyebrow="Essentials"
      title="Cheat sheets"
      subtitle="One-screen summaries to review right before a trip."
      backLabel="Back to Essentials">
      <View style={styles.list}>
        {CHEAT_SHEETS.map((sheet) => {
          const count = sheet.groups.reduce((total, group) => total + group.entries.length, 0);
          return (
            <SectionCard
              key={sheet.id}
              title={sheet.title}
              description={sheet.description}
              meta={`${count} phrases`}
              onPress={() => router.push({ pathname: '/essentials/cheatsheets/[id]', params: { id: sheet.id } })}
            />
          );
        })}
      </View>
    </EssentialsPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
