import { Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CityArt } from '@/components/art/CityArt';
import { art } from '@/components/art/palette';
import { Text } from '@/components/Text';
import { cityLook } from '@/lib/cityVisuals';
import { PIN, pinBox } from '@/lib/mapPins';
import type { City } from '@/types/api';
import { colors, fonts, radii } from '@/theme/theme';

/**
 * A city's pin on the map: its landmark in a badge, a point down to the city, and its name.
 * Coming-soon cities are smaller and washed out, with a lock. Sizes are fixed (and the text
 * doesn't scale) because the map lines the point up with the city from them; the sheet has the big text.
 */
export function CityPin({ city, selected, hidden = 0 }: { city: City; selected: boolean; hidden?: number }) {
  const open = city.available;
  const side = cityLook(city.slug).label;
  const box = pinBox(open, side);
  const badge = open ? PIN.badge.open : PIN.badge.soon;
  const ring = selected ? colors.sun400 : colors.surface;

  return (
    <View style={{ width: box.width, height: box.height }} pointerEvents="none">
      <View style={[styles.point, { left: box.tipX - 5, top: badge - 6.1, backgroundColor: ring }]} />
      <View style={[styles.badge, { left: box.badgeLeft, width: badge, height: badge, backgroundColor: ring }]}>
        <CityArt slug={city.slug} size={badge - 7} muted={!open} />
      </View>
      {open ? null : (
        <View style={[styles.chip, styles.lock, { left: box.badgeLeft + badge - 13, top: badge - 14 }]}>
          <Lock size={8} color={colors.surface} strokeWidth={3} />
        </View>
      )}
      {hidden > 0 ? (
        <View style={[styles.chip, styles.count, { left: box.badgeLeft + badge - 15, top: 0 }]}>
          <Text allowFontScaling={false} style={styles.countText}>
            +{hidden}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.labelSlot,
          {
            left: box.labelLeft,
            top: box.labelTop,
            width: box.labelWidth,
            alignItems: side === 'left' ? 'flex-end' : side === 'right' ? 'flex-start' : 'center',
          },
        ]}>
        <View
          style={[
            styles.label,
            open ? styles.labelOpen : styles.labelSoon,
            selected ? styles.labelSelected : null,
            { height: open ? PIN.label.open : PIN.label.soon },
          ]}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={open ? styles.nameOpen : styles.nameSoon}
            color={selected ? colors.surface : open ? colors.ink : colors.inkMuted}>
            {city.name}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  point: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: art.outline,
    transform: [{ rotate: '45deg' }],
  },
  badge: {
    position: 'absolute',
    top: 0,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: art.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  lock: { width: 15, height: 15, backgroundColor: colors.inkMuted },
  count: { minWidth: 20, height: 17, paddingHorizontal: 3, backgroundColor: colors.sky600 },
  countText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, color: colors.surface },
  labelSlot: { position: 'absolute' },
  label: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    maxWidth: '100%',
  },
  labelOpen: { backgroundColor: colors.surface, borderColor: art.outline },
  labelSoon: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: colors.line, paddingHorizontal: 6 },
  labelSelected: { backgroundColor: colors.sky600, borderColor: colors.sky700 },
  nameOpen: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16 },
  nameSoon: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
});
