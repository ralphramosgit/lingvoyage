import { RotateCcw } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, spacing } from '@/theme/theme';

import { Seagull } from './art/Seagull';
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
        <Seagull size={88} mood="worried" />
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
  button: { marginTop: spacing.sm, alignSelf: 'center' },
});
