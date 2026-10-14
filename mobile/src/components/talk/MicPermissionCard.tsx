import { Keyboard, MicOff, Settings, X } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { colors, motion, radii, spacing } from '@/theme/theme';

/** Explains why the mic is needed when permission was denied, with a way into Settings. */
export function MicPermissionCard({
  blocked,
  onTypeInstead,
  onDismiss,
  onTryAgain,
}: {
  /** iOS won't ask again: the only fix is the Settings app. */
  blocked: boolean;
  onTypeInstead: () => void;
  onDismiss: () => void;
  onTryAgain: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)}
      exiting={FadeOutDown.duration(motion.fast)}
      style={styles.card}
      accessibilityRole="alert">
      <View style={styles.header}>
        <View style={styles.icon}>
          <MicOff size={20} color={colors.danger} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">Microphone is off</Text>
          <Text variant="caption" color={colors.inkMuted}>
            Naviglot needs the microphone to hear you speak. In Expo Go, turn on Microphone under Settings, Expo Go.
          </Text>
        </View>
        <IconButton icon={X} accessibilityLabel="Dismiss" onPress={onDismiss} size={32} iconSize={16} />
      </View>
      <View style={styles.actions}>
        {blocked ? (
          <Button
            label="Open Settings"
            icon={Settings}
            size="md"
            onPress={() => void Linking.openSettings()}
            style={styles.flex}
          />
        ) : (
          <Button label="Allow microphone" size="md" onPress={onTryAgain} style={styles.flex} />
        )}
        <Button label="Type instead" icon={Keyboard} size="md" variant="secondary" onPress={onTypeInstead} style={styles.flex} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FBD5D5',
  },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
