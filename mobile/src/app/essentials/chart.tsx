import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { TONE_COLORS } from '@/components/essentials/ToneContour';
import { ToneSheet } from '@/components/essentials/ToneSheet';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { CHART_INITIALS, CHART_ROWS, type ChartSyllable } from '@/content/essentials/pinyinChart';
import { colors, layout, radii, spacing } from '@/theme/theme';

/** Tiles per row: four on a phone, six once there's room. */
const columnsFor = (width: number) => (width >= 480 ? 6 : 4);

export default function PinyinChartScreen() {
  const insets = useSafeAreaInsets();
  const [initialId, setInitialId] = useState('b');
  const [open, setOpen] = useState<ChartSyllable | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const close = useCallback(() => setOpen(null), []);

  const initial = CHART_INITIALS.find((item) => item.id === initialId) ?? CHART_INITIALS[0];
  const syllables = CHART_ROWS[initial.id];
  const columns = columnsFor(gridWidth);
  const tileWidth = gridWidth > 0 ? (gridWidth - spacing.sm * (columns - 1)) / columns : 0;

  return (
    <EssentialsPage
      eyebrow="Essentials"
      title="Pinyin chart"
      subtitle="Every syllable in Mandarin. Pick the sound it starts with, then tap a syllable to see and hear its four tones."
      backLabel="Back to Essentials"
      overlay={
        open ? <ToneSheet syllable={open.syllable} tones={open.tones} onClose={close} bottomInset={insets.bottom} /> : null
      }>
      <View style={styles.section}>
        <Text variant="tiny" color={colors.inkMuted}>
          STARTS WITH
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
          accessibilityRole="tablist">
          {CHART_INITIALS.map((item) => {
            const active = item.id === initial.id;
            return (
              <PressableScale
                key={item.id || 'none'}
                onPress={() => setInitialId(item.id)}
                accessibilityRole="tab"
                accessibilityLabel={item.id ? `Starts with ${item.label}` : 'No initial'}
                accessibilityState={{ selected: active }}
                style={[styles.chip, active ? styles.chipActive : null]}>
                <Text variant="label" color={active ? '#FFFFFF' : colors.ink}>
                  {item.label}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Card style={styles.hint}>
          <Text variant="heading">{initial.id || initial.label}</Text>
          <Text variant="body" color={colors.inkMuted}>
            {initial.hint}
          </Text>
          <Text variant="tiny" color={colors.inkMuted} style={styles.count}>
            {`${syllables.length} SYLLABLES`}
          </Text>
        </Card>

        <View style={styles.grid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
          {tileWidth > 0
            ? syllables.map((item) => (
                <SyllableTile key={item.syllable} item={item} width={tileWidth} onPress={() => setOpen(item)} />
              ))
            : null}
        </View>
      </View>

      <Text variant="caption" color={colors.inkMuted}>
        A colored dot is a tone with an everyday word to hear it in. Characters come from the Unicode Han Database.
      </Text>
    </EssentialsPage>
  );
}

function SyllableTile({ item, width, onPress }: { item: ChartSyllable; width: number; onPress: () => void }) {
  const count = item.tones.filter(Boolean).length;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.syllable}, ${count === 4 ? 'all four tones' : `${count} of 4 tones`}`}
      accessibilityHint="Shows its tones to hear"
      style={[styles.tile, { width }]}>
      <Text variant="subheading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {item.syllable}
      </Text>
      <View style={styles.dots}>
        {item.tones.map((slot, index) => (
          <View
            key={index}
            style={[styles.dot, { backgroundColor: slot ? TONE_COLORS[(index + 1) as 1 | 2 | 3 | 4] : colors.line }]}
          />
        ))}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  // Scrolls edge to edge, while the first chip still lines up with the text above.
  chipScroll: { marginHorizontal: -layout.screenPadding },
  chips: { gap: spacing.sm, paddingHorizontal: layout.screenPadding },
  chip: {
    minWidth: 44,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.sky600, borderColor: colors.sky600 },
  hint: { gap: spacing.xs },
  count: { marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
