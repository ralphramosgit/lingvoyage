import { useLocalSearchParams } from 'expo-router';

import { EssentialsNotFound } from '@/components/essentials/EssentialsNotFound';
import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { ReferenceTable } from '@/components/essentials/ReferenceTable';
import { findTable } from '@/content/essentials/tables';

export default function TableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const table = findTable(id);
  if (!table) return <EssentialsNotFound />;

  return (
    <EssentialsPage eyebrow="Tables" title={table.title} subtitle={table.description} backLabel="Back to Tables">
      <ReferenceTable rows={table.rows} />
    </EssentialsPage>
  );
}
