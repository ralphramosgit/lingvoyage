import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { SectionCard } from '@/components/essentials/SectionCard';
import { TABLES } from '@/content/essentials/tables';
import { spacing } from '@/theme/theme';

export default function TablesScreen() {
  return (
    <EssentialsPage eyebrow="Essentials" title="Tables" subtitle="Reference tables to scan at a glance." backLabel="Back to Essentials">
      <View style={styles.list}>
        {TABLES.map((table) => (
          <SectionCard
            key={table.id}
            title={table.title}
            description={table.description}
            meta={`${table.rows.length} rows`}
            onPress={() => router.push({ pathname: '/essentials/tables/[id]', params: { id: table.id } })}
          />
        ))}
      </View>
    </EssentialsPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
