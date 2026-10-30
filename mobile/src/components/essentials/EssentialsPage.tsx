import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { stopPlayback } from '@/lib/audio';
import { colors, motion, spacing } from '@/theme/theme';

/** How long an audio error stays up before it clears itself. */
const AUDIO_ERROR_MS = 5000;

const AudioErrorContext = createContext<(message: string) => void>(() => undefined);

/** For speaker buttons inside an Essentials page: shows the message at the top of the page. */
export function useAudioError() {
  return useContext(AudioErrorContext);
}

export function goBackToEssentials() {
  if (router.canGoBack()) router.back();
  else router.replace('/essentials');
}

/** A screen under Essentials: back button, title, and a pinned banner when audio fails (e.g. offline). */
export function EssentialsPage({
  eyebrow,
  title,
  subtitle,
  backLabel = 'Back',
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => () => stopPlayback(), []);

  useEffect(() => {
    if (!audioError) return;
    const timer = setTimeout(() => setAudioError(null), AUDIO_ERROR_MS);
    return () => clearTimeout(timer);
  }, [audioError]);

  return (
    <AudioErrorContext.Provider value={setAudioError}>
      <Screen
        scroll
        edges={['top']}
        header={
          <View style={styles.header}>
            <View style={styles.backRow}>
              <IconButton
                icon={ChevronLeft}
                accessibilityLabel={backLabel}
                onPress={goBackToEssentials}
                variant="surface"
                iconSize={22}
              />
            </View>
            {audioError ? <FormMessage message={audioError} /> : null}
          </View>
        }
        contentStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.titles}>
          {eyebrow ? (
            <Text variant="tiny" color={colors.inkMuted}>
              {eyebrow.toUpperCase()}
            </Text>
          ) : null}
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={colors.inkMuted}>
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)} style={styles.body}>
          {children}
        </Animated.View>
      </Screen>
    </AudioErrorContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  backRow: { paddingTop: spacing.sm, alignItems: 'flex-start' },
  content: { gap: spacing.xxl, paddingTop: spacing.sm },
  titles: { gap: spacing.xs },
  body: { gap: spacing.xxl },
});
