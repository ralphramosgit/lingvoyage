import { Check, LocateFixed } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { PressableScale } from '@/components/PressableScale';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Text } from '@/components/Text';
import { useCities } from '@/hooks/useCities';
import { findNearestCity, NEAR_CITY_KM } from '@/lib/location';
import type { City } from '@/types/api';
import { colors, motion, radii, shadows, spacing } from '@/theme/theme';

/** The supported cities, with "Use my location". Used by onboarding and the Destination screen. */
export function CityPicker({ selected, onSelect }: { selected: string | null; onSelect: (slug: string) => void }) {
  const { cities, loading, error, reload } = useCities();
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const useMyLocation = async () => {
    if (!cities) return;
    setLocating(true);
    setLocationNote(null);
    const result = await findNearestCity(cities);
    setLocating(false);
    if (result.kind === 'found') {
      onSelect(result.city.slug);
      setLocationNote(`You're near ${result.city.name} (${Math.round(result.km)} km), so we picked it.`);
    } else if (result.kind === 'far') {
      setLocationNote(`You're not near a city we support yet (none within ${NEAR_CITY_KM} km). Pick where you're going.`);
    } else if (result.kind === 'denied') {
      setLocationNote(
        result.canAskAgain
          ? 'No problem: pick your city from the list.'
          : 'Location is off for Lingvoyage. You can turn it on in Settings, or pick your city from the list.',
      );
    } else {
      setLocationNote("We couldn't find your location. Pick your city from the list.");
    }
  };

  if (cities === null && error) {
    return <ErrorState title="Couldn't load the cities" message={error} onRetry={reload} retrying={loading} />;
  }

  return (
    <View style={styles.wrap}>
      <Button
        label="Use my location"
        icon={LocateFixed}
        variant="secondary"
        onPress={useMyLocation}
        loading={locating}
        disabled={cities === null}
        accessibilityHint="Picks the supported city nearest to you. Your location isn't saved."
      />
      {locationNote ? (
        <Text variant="caption" color={colors.inkMuted} accessibilityLiveRegion="polite">
          {locationNote}
        </Text>
      ) : null}

      <View style={styles.list} accessibilityRole="radiogroup">
        {cities === null ? [0, 1, 2].map((key) => <SkeletonCard key={key} />) : null}
        {cities?.map((city, index) => (
          <Animated.View key={city.slug} entering={FadeInDown.duration(motion.base).delay(index * motion.stagger)}>
            <CityCard city={city} selected={selected === city.slug} onSelect={() => onSelect(city.slug)} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function CityCard({ city, selected, onSelect }: { city: City; selected: boolean; onSelect: () => void }) {
  const where = city.province ? `${city.pinyin} · ${city.province}` : city.pinyin;
  return (
    <PressableScale
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityLabel={`${city.name}, ${city.hanzi}${city.province ? `, ${city.province}` : ''}`}
      accessibilityState={{ selected }}
      style={[styles.card, selected ? styles.cardSelected : null]}>
      <View style={[styles.hanziTile, selected ? styles.hanziTileSelected : null]}>
        <Text variant="hanzi" color={colors.sky700} numberOfLines={1} adjustsFontSizeToFit>
          {city.hanzi}
        </Text>
      </View>
      <View style={styles.cardText}>
        <Text variant="subheading">{city.name}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {where}
        </Text>
      </View>
      <Animated.View layout={LinearTransition.duration(motion.fast)} style={[styles.radio, selected ? styles.radioSelected : null]}>
        {selected ? (
          <Animated.View entering={ZoomIn.duration(motion.base)}>
            <Check size={16} color={colors.surface} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  list: { gap: spacing.md, marginTop: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    minHeight: 76,
    ...shadows.card,
  },
  cardSelected: { borderColor: colors.sky500, backgroundColor: colors.sky50 },
  hanziTile: {
    width: 56,
    height: 56,
    borderRadius: radii.input,
    backgroundColor: colors.sky50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  hanziTileSelected: { backgroundColor: colors.sky100 },
  cardText: { flex: 1, gap: 2 },
  radio: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.sky600, borderColor: colors.sky600 },
});
