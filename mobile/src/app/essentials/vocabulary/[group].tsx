import { useLocalSearchParams } from 'expo-router';

import { EntryList } from '@/components/essentials/EntryRow';
import { EssentialsNotFound } from '@/components/essentials/EssentialsNotFound';
import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { findVocabGroup } from '@/content/essentials/vocabulary';

export default function VocabGroupScreen() {
  const { group: groupId } = useLocalSearchParams<{ group: string }>();
  const group = findVocabGroup(groupId);
  if (!group) return <EssentialsNotFound />;

  return (
    <EssentialsPage eyebrow="Vocabulary" title={group.title} subtitle={group.description} backLabel="Back to Vocabulary">
      <EntryList entries={group.words} />
    </EssentialsPage>
  );
}
