import { Check, Lock, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityArt } from '@/components/art/CityArt';
import { art } from '@/components/art/palette';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { Pill } from '@/components/Pill';
import { Text } from '@/components/Text';
import { cityLook } from '@/lib/cityVisuals';
import type { City } from '@/types/api';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';

/**
 * What opens when a pin is tapped: pick the city, or hear that it's coming soon.
 * `city` stays set while the sheet fades out, so it doesn't empty as it closes.
 */
export function CitySheet({
  city,
  visible,
  current,
  openNames,
  nearby,
  nearKm,
  saving,
  error,
  onChoose,
  onClose,
}: {
  city: City | null;
  visible: boolean;
  /** The learner's destination now, if they have one. */
  current: string | null;
  /** "Beijing, Shanghai, Chengdu or Chongqing". */
  openNames: string;
  /** Coming-soon cities whose pins are hidden under this one until the map zooms in. */
  nearby: City[];
  /** Set when "Use my location" picked this city. */
  nearKm: number | null;
  saving: boolean;
  error: string | null;
  onChoose: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const close = saving ? () => undefined : onClose;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      {city ? (
        <Animated.View key={city.slug} entering={SlideInDown.duration(motion.slow)} style={styles.dock}>
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}
            accessibilityViewIsModal>
            <View style={styles.handle} />
            <View style={styles.closeRow}>
              <IconButton icon={X} accessibilityLabel="Close" onPress={close} disabled={saving} />
            </View>

            <View style={styles.hero}>
              <View style={[styles.artRing, city.available ? null : styles.artRingSoon]}>
                <CityArt slug={city.slug} size={92} muted={!city.available} />
              </View>
              <View style={styles.titleBlock}>
                <Text variant="title" accessibilityRole="header">
                  {city.name}
                </Text>
                <Text variant="hanzi" color={colors.sky700}>
                  {city.hanzi}
                </Text>
                <Text variant="caption" color={colors.inkMuted}>
                  {city.province ? `${city.pinyin} · ${city.province}` : city.pinyin}
                </Text>
              </View>
            </View>

            {cityLook(city.slug).note ? (
              <Text variant="body" color={colors.inkMuted}>
                {cityLook(city.slug).note}
              </Text>
            ) : null}
            {nearKm !== null ? (
              <Text variant="caption" color={colors.inkMuted}>
                You&apos;re about {Math.round(nearKm)} km from {city.name}.
              </Text>
            ) : null}

            {nearby.length > 0 ? (
              <View style={styles.nearby}>
                <Lock size={14} color={colors.inkMuted} strokeWidth={2.4} />
                <Text variant="caption" color={colors.inkMuted} style={styles.flex}>
                  Nearby, coming soon: {nearby.map((other) => other.name).join(', ')}. Zoom in to see their pins.
                </Text>
              </View>
            ) : null}

            {city.available ? (
              <>
                {city.slug === current ? <Pill label="Your destination" icon={Check} tone="success" /> : null}
                {error ? <FormMessage message={error} /> : null}
                <Button
                  label={city.slug === current ? `Keep ${city.name}` : `Choose ${city.name}`}
                  onPress={onChoose}
                  loading={saving}
                  style={styles.action}
                  accessibilityHint="Your lessons, quizzes and scenes follow your destination."
                />
              </>
            ) : (
              <>
                <Pill label="Coming soon" icon={Lock} tone="neutral" />
                <Text variant="body">
                  We&apos;re still getting {city.name} ready. For now, pick {openNames}.
                </Text>
                <Button label="OK" variant="secondary" onPress={close} style={styles.action} />
              </>
            )}
          </View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,31,51,0.45)' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line },
  closeRow: { position: 'absolute', top: spacing.sm, right: spacing.md, zIndex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  artRing: {
    padding: 3,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: art.outline,
    backgroundColor: colors.surface,
  },
  artRingSoon: { borderColor: colors.line },
  titleBlock: { flex: 1, gap: 2 },
  action: { marginTop: spacing.xs },
  nearby: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
