import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { SectionCard } from '@/components/essentials/SectionCard';
import { GRAMMAR_POINTS } from '@/content/essentials/grammar';
import { spacing } from '@/theme/theme';

export default function GrammarScreen() {
  return (
    <EssentialsPage
      eyebrow="Essentials"
      title="Grammar"
      subtitle="The most common beginner patterns, one at a time."
      backLabel="Back to Essentials">
      <View style={styles.list}>
        {GRAMMAR_POINTS.map((point) => (
          <SectionCard
            key={point.id}
            title={point.title}
            description={`${point.pattern.pinyin}: ${point.pattern.english}`}
            meta={`${point.examples.length} examples`}
            onPress={() => router.push({ pathname: '/essentials/grammar/[id]', params: { id: point.id } })}
          />
        ))}
      </View>
    </EssentialsPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
