import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { SectionCard } from '@/components/essentials/SectionCard';
import { VOCAB_GROUPS } from '@/content/essentials/vocabulary';
import { spacing } from '@/theme/theme';

export default function VocabularyScreen() {
  return (
    <EssentialsPage
      eyebrow="Essentials"
      title="Vocabulary"
      subtitle="Beginner words, grouped by type."
      backLabel="Back to Essentials">
      <View style={styles.list}>
        {VOCAB_GROUPS.map((group) => (
          <SectionCard
            key={group.id}
            title={group.title}
            description={group.description}
            meta={`${group.words.length} words`}
            onPress={() => router.push({ pathname: '/essentials/vocabulary/[group]', params: { group: group.id } })}
          />
        ))}
      </View>
    </EssentialsPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
