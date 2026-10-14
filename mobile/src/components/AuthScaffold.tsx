import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, motion, spacing } from '@/theme/theme';

import { Card } from './Card';
import { IconButton } from './IconButton';
import { Screen } from './Screen';
import { Text } from './Text';

type AuthScaffoldProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  footer?: ReactNode;
}>;

/** Shared layout for sign up / sign in: back to Welcome, title, form card, footer link. */
export function AuthScaffold({ title, subtitle, footer, children }: AuthScaffoldProps) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  };

  return (
    <Screen scroll keyboard>
      <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.flex}>
        <View style={styles.topBar}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Back to welcome" onPress={goBack} variant="surface" iconSize={22} />
        </View>

        <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color={colors.inkMuted}>
            {subtitle}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(motion.base).delay(60)}>
          <Card style={styles.card}>{children}</Card>
        </Animated.View>

        {footer ? (
          <Animated.View entering={FadeInDown.duration(motion.base).delay(120)} style={styles.footer}>
            {footer}
          </Animated.View>
        ) : null}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingTop: spacing.sm, paddingBottom: spacing.lg, alignItems: 'flex-start' },
  header: { gap: spacing.sm, marginBottom: spacing.xxl },
  card: { gap: spacing.xl, padding: spacing.xl },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
});
