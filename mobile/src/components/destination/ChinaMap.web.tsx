import { useImperativeHandle } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { ChinaMapProps } from '@/lib/mapPins';
import { colors, spacing } from '@/theme/theme';

import { CityPin } from './CityPin';

/** react-native-maps doesn't run on the web, so the web build lists the same pins instead of a map. */
export function ChinaMap({ cities, selected, onPick, ref }: ChinaMapProps) {
  useImperativeHandle(ref, () => ({ showAll: () => undefined, focus: () => undefined }));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="caption" color={colors.inkMuted} align="center">
        The map is in the phone app. Here, pick from the pins.
      </Text>
      <View style={styles.grid}>
        {cities.map((city) => (
          <PressableScale
            key={city.slug}
            onPress={() => onPick(city, [])}
            accessibilityRole="button"
            accessibilityLabel={city.available ? city.name : `${city.name}, coming soon`}>
            <CityPin city={city} selected={city.slug === selected} />
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Clear of the legend above and the buttons below.
  content: { padding: spacing.xl, paddingTop: 72, paddingBottom: 120, gap: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg },
});
