import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { colors, radii, spacing, tints, type TintName } from '@/theme/theme';

/** A tappable card on the Essentials hub and its lists: icon tile, title, one line, chevron. */
export function SectionCard({
  title,
  description,
  icon: Icon,
  tint = 'sky',
  meta,
  onPress,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  tint?: TintName;
  /** Small caps line under the description, e.g. "5 words". */
  meta?: string;
  onPress: () => void;
}) {
  const palette = tints[tint];
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[title, description, meta].filter(Boolean).join('. ')}
      accessibilityHint={`Opens ${title}`}
      style={styles.card}>
      {Icon ? (
        <View style={[styles.tile, { backgroundColor: palette.bg }]}>
          <Icon size={26} color={palette.fg} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.titles}>
        <Text variant="subheading">{title}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {description}
        </Text>
        {meta ? (
          <Text variant="tiny" color={colors.inkMuted} style={styles.meta}>
            {meta.toUpperCase()}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color={colors.inkMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  tile: { width: 52, height: 52, borderRadius: radii.card, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
  meta: { marginTop: spacing.xs },
});
