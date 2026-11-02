import { ExternalLink, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { openSource } from '@/lib/sources';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';
import type { Source } from '@/types/api';

/** The pages local content came from: a scene's details (#39) or a unit's notes (#40). Each opens in the in-app browser. */
export function SourcesSheet({
  sources,
  checkedOn,
  what = "this scene's details",
  onClose,
  bottomInset,
}: {
  sources: Source[];
  /** "Oct 31". */
  checkedOn: string | null;
  /** What the sources are for, e.g. "these notes". */
  what?: string;
  onClose: () => void;
  bottomInset: number;
}) {
  return (
    <Animated.View exiting={FadeOut.duration(motion.fast)} style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(motion.base)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sources" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(motion.slow)} style={styles.sheetDock}>
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, spacing.lg) + spacing.sm }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text variant="heading" accessibilityRole="header" style={styles.flex}>
              Sources
            </Text>
            <IconButton icon={X} accessibilityLabel="Close sources" onPress={onClose} />
          </View>
          <Text variant="caption" color={colors.inkMuted}>
            An AI agent found {what} on these pages{checkedOn ? ` on ${checkedOn}` : ''}. Prices and hours may have
            changed since.
          </Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sources.map((source, index) => (
              <PressableScale
                key={source.url}
                onPress={() => openSource(source.url)}
                accessibilityRole="link"
                accessibilityLabel={`${source.title}. Opens the page.`}
                style={[styles.sourceRow, index > 0 ? styles.divider : null]}>
                <View style={styles.flex}>
                  <Text variant="label" numberOfLines={2}>
                    {source.title}
                  </Text>
                  <Text variant="tiny" color={colors.inkMuted} numberOfLines={1}>
                    {hostOf(source.url)}
                  </Text>
                </View>
                <ExternalLink size={16} color={colors.inkMuted} />
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,31,51,0.45)' },
  sheetDock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { marginTop: spacing.sm },
  listContent: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.card },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
});
