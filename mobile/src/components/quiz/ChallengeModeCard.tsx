import { StyleSheet, Switch, View } from 'react-native';

import { Sailboat } from '@/components/art/Sailboat';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useSettings } from '@/lib/settings';
import { HULL, REPAIR_STREAK } from '@/lib/voyage';
import { colors, radii, spacing } from '@/theme/theme';

/** The Quiz tab's switch for challenge mode (issue #61). The same setting as on Profile, so it covers lessons too. */
export function ChallengeModeCard() {
  const { settings, updateSetting } = useSettings();
  const on = settings.challengeMode;

  return (
    <Card style={[styles.card, on ? styles.on : null]}>
      <View style={styles.tile}>
        <Sailboat size={36} />
      </View>
      <View style={styles.titles}>
        <Text variant="bodyStrong">Challenge mode</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {on
            ? `Your boat has ${HULL} hull points. Each miss costs one, ${REPAIR_STREAK} right in a row patches a leak, and if it sinks you start over.`
            : 'Sail with a hull: misses damage the boat, and if it sinks you start over.'}
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={(value) => updateSetting('challengeMode', value)}
        trackColor={{ true: colors.sky500, false: colors.line }}
        ios_backgroundColor={colors.line}
        accessibilityLabel="Challenge mode"
        accessibilityHint="In lessons and quizzes, misses damage the boat's hull"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  on: { borderColor: colors.sky500, backgroundColor: colors.sky50 },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sky100,
  },
  titles: { flex: 1, gap: 2 },
});
