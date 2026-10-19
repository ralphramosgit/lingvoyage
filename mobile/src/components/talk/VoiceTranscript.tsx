import { CircleAlert, CircleCheck, RotateCcw } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import type { LiveStatus } from '@/hooks/useLiveTranscript';
import { colors, motion, radii, spacing } from '@/theme/theme';

/** What the mic heard, shown in the input bar: live while recording, then the transcript to check. */
export type VoiceTranscriptState =
  | { phase: 'listening'; text: string; live: LiveStatus }
  | { phase: 'checking'; text: string }
  | { phase: 'ready'; text: string }
  | { phase: 'failed'; message: string; onRetry?: () => void };

// About four lines of hanzi; longer transcripts scroll, newest words in view.
const MAX_TEXT_HEIGHT = 120;

function PulseDot() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withSequence(withTiming(0.25, { duration: 500 }), withTiming(1, { duration: 500 })), -1, false));
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.liveDot, style]} />;
}

function listeningPlaceholder(live: LiveStatus): string {
  if (live === 'unavailable') return "Live captions aren't available right now, but your voice is still being recorded.";
  if (live === 'live') return 'Start speaking in Mandarin. Your words show up here.';
  return 'Start speaking...';
}

export function VoiceTranscript({ state }: { state: VoiceTranscriptState }) {
  const scrollRef = useRef<ScrollView>(null);

  let header: ReactNode;
  let body: ReactNode;
  switch (state.phase) {
    case 'listening':
      header = (
        <>
          <PulseDot />
          <Text variant="tiny" color={colors.danger}>
            Listening
          </Text>
        </>
      );
      body = state.text ? (
        <Text variant="hanzi" color={colors.ink}>
          {state.text}
        </Text>
      ) : (
        <Text variant="caption" color={colors.inkMuted}>
          {listeningPlaceholder(state.live)}
        </Text>
      );
      break;
    case 'checking':
      header = (
        <>
          <ActivityIndicator size="small" color={colors.sky700} />
          <Text variant="tiny" color={colors.sky700}>
            Checking what you said
          </Text>
        </>
      );
      body = (
        <Text variant="hanzi" color={colors.inkMuted}>
          {state.text || '...'}
        </Text>
      );
      break;
    case 'ready':
      header = (
        <>
          <CircleCheck size={14} color={colors.success} strokeWidth={2.5} />
          <Text variant="tiny" color={colors.sky700}>
            Ready to send
          </Text>
        </>
      );
      body = (
        <Text variant="hanzi" color={colors.ink} selectable>
          {state.text}
        </Text>
      );
      break;
    case 'failed':
      header = (
        <>
          <CircleAlert size={14} color={colors.danger} strokeWidth={2.5} />
          <Text variant="tiny" color={colors.danger}>
            Not sent
          </Text>
        </>
      );
      body = (
        <Text variant="caption" color="#991B1B">
          {state.message}
        </Text>
      );
      break;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(motion.fast)}
      style={[styles.panel, PANEL_LOOK[state.phase]]}
      accessibilityLiveRegion="polite">
      <View style={styles.header}>{header}</View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {body}
      </ScrollView>
      {state.phase === 'failed' && state.onRetry ? (
        <Button label="Try again" icon={RotateCcw} size="md" variant="secondary" onPress={state.onRetry} style={styles.retry} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radii.card,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scroll: { maxHeight: MAX_TEXT_HEIGHT, flexGrow: 0 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  retry: { alignSelf: 'flex-start', marginTop: spacing.xs },
});

const PANEL_LOOK = StyleSheet.create({
  listening: { backgroundColor: colors.sky50, borderColor: colors.sky500, borderStyle: 'dashed' },
  checking: { backgroundColor: colors.sky50, borderColor: colors.sky500, borderStyle: 'dashed' },
  ready: { backgroundColor: colors.sky100, borderColor: colors.sky500 },
  failed: { backgroundColor: '#FEF2F2', borderColor: '#FBD5D5' },
});
