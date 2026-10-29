import { BookOpen } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors, motion, radii, spacing } from '@/theme/theme';

// Placeholder until the Lessons tab is built (issue #12).
export default function LessonsScreen() {
  return (
    <Screen scroll edges={['top']}>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Lessons
        </Text>
        <Text variant="body" color={colors.inkMuted}>
          Step-by-step lessons for your trip.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)}>
        <Card style={styles.card}>
          <View style={styles.icon}>
            <BookOpen size={26} color={colors.sky700} />
          </View>
          <Text variant="subheading" align="center">
            Coming soon
          </Text>
          <Text variant="caption" color={colors.inkMuted} align="center">
            Numbers, money, ordering food, asking directions and more.
          </Text>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingTop: spacing.lg, marginBottom: spacing.xl },
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
});
