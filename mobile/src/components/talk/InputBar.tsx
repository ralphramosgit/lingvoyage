import { Keyboard, Lightbulb, Mic, SendHorizontal, X } from 'lucide-react-native';
import { type Ref, useEffect } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, fonts, radii, spacing } from '@/theme/theme';

const MIC_SIZE = 76;

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `0:${String(Math.min(seconds, 59)).padStart(2, '0')}`;
}

function MicButton({ recording, disabled, onPress }: { recording: boolean; disabled: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (recording && !reduceMotion) {
      pulse.set(0);
      pulse.set(withRepeat(withTiming(1, { duration: 1100 }), -1, false));
    } else {
      cancelAnimation(pulse);
      pulse.set(0);
    }
  }, [recording, reduceMotion, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: recording ? (reduceMotion ? 0.5 : 0.6 * (1 - pulse.get())) : 0,
    transform: [{ scale: reduceMotion ? 1.18 : 1 + pulse.get() * 0.5 }],
  }));

  return (
    <View style={styles.micWrap}>
      <Animated.View pointerEvents="none" style={[styles.micRing, ringStyle]} />
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop and send' : 'Start recording'}
        accessibilityHint={recording ? undefined : 'Tap, speak, then tap again to send'}
        accessibilityState={{ disabled, busy: recording }}
        style={[styles.mic, recording ? styles.micRecording : null, disabled ? styles.micDisabled : null]}>
        <Mic size={32} color={colors.ink} strokeWidth={2.4} />
      </PressableScale>
    </View>
  );
}

export type InputMode = 'voice' | 'text';

export function InputBar({
  mode,
  onModeChange,
  busy,
  locked,
  recording,
  elapsedMs,
  maxMs,
  onMicPress,
  onCancelRecording,
  draft,
  onDraftChange,
  onSend,
  suggestionsOn,
  onToggleSuggestions,
  hint,
  bottomInset,
  inputRef,
}: {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  /** A request is in flight. */
  busy: boolean;
  /** The encounter is over. */
  locked: boolean;
  recording: boolean;
  elapsedMs: number;
  maxMs: number;
  onMicPress: () => void;
  onCancelRecording: () => void;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  suggestionsOn: boolean;
  onToggleSuggestions: () => void;
  hint: string | null;
  bottomInset: number;
  inputRef: Ref<TextInput>;
}) {
  const disabled = busy || locked;
  const lightbulb = (
    <IconButton
      icon={Lightbulb}
      accessibilityLabel={suggestionsOn ? 'Hide suggestions' : 'Show suggestions'}
      onPress={onToggleSuggestions}
      variant={suggestionsOn ? 'sun' : 'surface'}
      active={suggestionsOn}
      disabled={locked}
    />
  );

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
      {hint ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.hint} accessibilityLiveRegion="polite">
          <Text variant="caption" color={colors.inkMuted} align="center">
            {hint}
          </Text>
        </Animated.View>
      ) : null}

      {mode === 'voice' ? (
        <View style={styles.voiceRow}>
          <View style={styles.side}>
            {recording ? (
              <IconButton icon={X} accessibilityLabel="Cancel recording" onPress={onCancelRecording} variant="surface" />
            ) : (
              <IconButton
                icon={Keyboard}
                accessibilityLabel="Switch to typing"
                onPress={() => onModeChange('text')}
                variant="surface"
                disabled={locked}
              />
            )}
          </View>

          <MicButton recording={recording} disabled={disabled && !recording} onPress={onMicPress} />

          <View style={[styles.side, styles.sideRight]}>
            {recording ? (
              <View style={styles.timer} accessibilityLabel={`Recording, ${Math.floor(elapsedMs / 1000)} seconds`}>
                <View style={styles.recDot} />
                <Text style={styles.timerText}>{formatElapsed(elapsedMs)}</Text>
                <Text variant="tiny" color={colors.inkMuted}>
                  / {formatElapsed(maxMs)}
                </Text>
              </View>
            ) : (
              lightbulb
            )}
          </View>
        </View>
      ) : (
        <View style={styles.textRow}>
          <IconButton
            icon={Mic}
            accessibilityLabel="Switch to speaking"
            onPress={() => onModeChange('voice')}
            variant="surface"
            disabled={locked}
          />
          {lightbulb}
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Type in Chinese, pinyin or English"
            placeholderTextColor="#8A9BAE"
            style={styles.input}
            multiline
            maxLength={500}
            editable={!locked}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={onSend}
            accessibilityLabel="Your message"
            maxFontSizeMultiplier={1.4}
          />
          <IconButton
            icon={SendHorizontal}
            accessibilityLabel="Send"
            onPress={onSend}
            variant="primary"
            disabled={disabled || draft.trim() === ''}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.sm,
  },
  hint: { alignSelf: 'center', paddingHorizontal: spacing.md },
  voiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 96, alignItems: 'flex-start', justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  micWrap: { width: MIC_SIZE + 24, height: MIC_SIZE + 24, alignItems: 'center', justifyContent: 'center' },
  micRing: {
    position: 'absolute',
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: colors.sun300,
  },
  mic: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: colors.sun400,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A16207',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  micRecording: { backgroundColor: colors.sun300, borderWidth: 3, borderColor: colors.sun400 },
  micDisabled: { backgroundColor: '#E8EDF2', shadowOpacity: 0, elevation: 0, opacity: 0.6 },
  timer: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, alignSelf: 'center' },
  timerText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  textRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 12 : spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 12 : spacing.sm,
    borderRadius: radii.sheet,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
});
