import { Expand, LocateFixed, Lock } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { VoyageLoader } from '@/components/VoyageLoader';
import { useCities } from '@/hooks/useCities';
import { findNearestCity, NEAR_CITY_KM } from '@/lib/location';
import type { ChinaMapHandle } from '@/lib/mapPins';
import { playSound } from '@/lib/sounds';
import type { City } from '@/types/api';
import { colors, motion, radii, shadows, spacing } from '@/theme/theme';

import { ChinaMap } from './ChinaMap';
import { CitySheet } from './CitySheet';

// Map space the floating legend (top) and buttons (bottom) take up.
const LEGEND_SPACE = 48;
const BUTTON_SPACE = 56;

/**
 * Pick where you're going on a map of China (issue #66). Tapping a pin opens its sheet: choose an open
 * city, or see that it's coming soon. Used by onboarding and the Destination screen.
 *
 * `onChoose` saves the city and returns an error message, or null once it's saved (the screen then moves on).
 */
export function DestinationMap({
  current,
  onChoose,
}: {
  current: string | null;
  onChoose: (slug: string) => Promise<string | null>;
}) {
  const { cities, loading, error, reload } = useCities();
  const insets = useSafeAreaInsets();
  const map = useRef<ChinaMapHandle>(null);
  const [sheet, setSheet] = useState<{ city: City; nearby: City[]; km: number | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (cities === null) {
    return (
      <View style={styles.center}>
        {error ? (
          <ErrorState title="Couldn't load the map" message={error} onRetry={reload} retrying={loading} />
        ) : (
          <VoyageLoader label="Loading the map…" />
        )}
      </View>
    );
  }

  const openNames = (() => {
    const names = cities.filter((city) => city.available).map((city) => city.name);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : (names[0] ?? '');
  })();

  const openSheet = (city: City, nearby: City[] = [], km: number | null = null) => {
    setSheet({ city, nearby, km });
    setSheetOpen(true);
    setSaveError(null);
    setNote(null);
  };

  const choose = async () => {
    if (!sheet) return;
    setSaving(true);
    setSaveError(null);
    const problem = await onChoose(sheet.city.slug);
    setSaving(false);
    if (problem) setSaveError(problem);
    else playSound('goal');
  };

  const useMyLocation = async () => {
    setLocating(true);
    setNote(null);
    const result = await findNearestCity(cities);
    setLocating(false);
    if (result.kind === 'found') {
      map.current?.focus(result.city);
      openSheet(result.city, [], result.km);
    } else if (result.kind === 'far') {
      setNote(`You're not near a city on the map (none within ${NEAR_CITY_KM} km). Tap a pin to pick where you're going.`);
    } else if (result.kind === 'denied') {
      setNote(
        result.canAskAgain
          ? 'No problem: tap a pin to pick your city.'
          : 'Location is off for Lingvoyage. You can turn it on in Settings, or tap a pin to pick your city.',
      );
    } else {
      setNote("We couldn't find your location. Tap a pin to pick your city.");
    }
  };

  const bottom = Math.max(insets.bottom, spacing.md) + spacing.sm;

  return (
    <View style={styles.wrap}>
      <ChinaMap
        ref={map}
        cities={cities}
        selected={current}
        onPick={(city, nearby) => openSheet(city, nearby)}
        overlay={{ top: LEGEND_SPACE, bottom: bottom + BUTTON_SPACE }}
      />

      <View style={styles.legend} pointerEvents="none" accessible accessibilityLabel={`Open now: ${openNames}. The other pins are coming soon.`}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotOpen]} />
          <Text variant="tiny">Open now</Text>
        </View>
        <View style={styles.legendItem}>
          <Lock size={12} color={colors.inkMuted} strokeWidth={2.6} />
          <Text variant="tiny" color={colors.inkMuted}>
            Coming soon
          </Text>
        </View>
      </View>

      <View style={[styles.controls, { bottom }]} pointerEvents="box-none">
        {note ? (
          <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)}>
            <PressableScale
              onPress={() => setNote(null)}
              accessibilityRole="button"
              accessibilityHint="Dismisses this note"
              style={styles.note}>
              <Text variant="caption" accessibilityLiveRegion="polite">
                {note}
              </Text>
            </PressableScale>
          </Animated.View>
        ) : null}
        <View style={styles.buttons} pointerEvents="box-none">
          <Button
            label="Use my location"
            icon={LocateFixed}
            variant="secondary"
            size="md"
            onPress={useMyLocation}
            loading={locating}
            accessibilityHint="Finds the city on the map nearest to you. Your location isn't saved."
            style={styles.raised}
          />
          <IconButton
            icon={Expand}
            variant="surface"
            size={48}
            accessibilityLabel="Show all cities"
            onPress={() => map.current?.showAll()}
            style={styles.raised}
          />
        </View>
      </View>

      <CitySheet
        city={sheet?.city ?? null}
        visible={sheetOpen}
        current={current}
        openNames={openNames}
        nearby={sheet?.nearby ?? []}
        nearKm={sheet?.km ?? null}
        saving={saving}
        error={saveError}
        onChoose={choose}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  legend: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
    ...shadows.card,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  dot: { width: 10, height: 10, borderRadius: radii.full, borderWidth: 1.5 },
  dotOpen: { backgroundColor: colors.sky500, borderColor: colors.ink },
  controls: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: {
    padding: spacing.md,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  raised: { ...shadows.raised },
});
