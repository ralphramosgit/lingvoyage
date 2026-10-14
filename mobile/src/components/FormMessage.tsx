import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, radii, spacing } from '@/theme/theme';

import { Text } from './Text';

/** Inline banner for form-level errors (or a success note). */
export function FormMessage({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' }) {
  const isError = tone === 'error';
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      accessibilityLiveRegion="polite"
      accessibilityRole={isError ? 'alert' : undefined}
      style={[styles.box, isError ? styles.error : styles.success]}>
      <Icon size={18} color={isError ? colors.danger : colors.success} />
      <View style={styles.flex}>
        <Text variant="caption" color={isError ? '#991B1B' : '#166534'}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
  },
  error: { backgroundColor: '#FEF2F2', borderColor: '#FBD5D5' },
  success: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
});
