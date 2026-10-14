import { CloudOff, RotateCcw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, radii, spacing } from '@/theme/theme';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Card style={styles.card}>
        <View style={styles.icon}>
          <CloudOff size={26} color={colors.sky700} />
        </View>
        <Text variant="subheading" align="center">
          {title}
        </Text>
        <Text variant="caption" color={colors.inkMuted} align="center">
          {message}
        </Text>
        <Button label="Retry" icon={RotateCcw} variant="secondary" size="md" onPress={onRetry} loading={retrying} style={styles.button} />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  button: { marginTop: spacing.sm, alignSelf: 'center' },
});
