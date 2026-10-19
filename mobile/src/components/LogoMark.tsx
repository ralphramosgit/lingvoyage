import { Image, StyleSheet, View } from 'react-native';

import { shadows } from '@/theme/theme';

const LOGO = require('@/assets/images/lingvoyage-logo.png');

// The logo PNG draws its own rounded sky-blue tile. The wrapper repeats that tile's color and corner
// radius so the shadow follows the rounded corners.
const TILE_COLOR = '#74BBF9';
const TILE_RADIUS = 0.227;

/** Lingvoyage logo: the sailboat with "LV" sails and a speech bubble, on its sky-blue rounded tile. */
export function LogoMark({ size = 88 }: { size?: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Lingvoyage logo"
      style={[styles.tile, { width: size, height: size, borderRadius: size * TILE_RADIUS }]}>
      <Image source={LOGO} style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: TILE_COLOR,
    ...shadows.raised,
  },
});
