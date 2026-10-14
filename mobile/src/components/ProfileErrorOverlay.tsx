import { CloudOff, LogOut, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useAuth } from '@/lib/auth';
import { colors, radii, spacing } from '@/theme/theme';

import { Button } from './Button';
import { Screen } from './Screen';
import { Text } from './Text';

/** Shown when there's a session but the profile couldn't be loaded (usually offline at launch). */
export function ProfileErrorOverlay() {
  const { refreshProfile, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
      <Screen contentStyle={styles.center}>
        <View style={styles.iconWrap}>
          <CloudOff size={32} color={colors.sky700} />
        </View>
        <Text variant="heading" align="center">
          We couldn&apos;t load your profile
        </Text>
        <Text variant="body" color={colors.inkMuted} align="center">
          Check your internet connection and try again.
        </Text>
        <View style={styles.actions}>
          <Button label="Try again" icon={RotateCcw} onPress={retry} loading={retrying} />
          <Button label="Log out" icon={LogOut} variant="ghost" onPress={() => void signOut()} />
        </View>
      </Screen>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'stretch', gap: spacing.md },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
});
