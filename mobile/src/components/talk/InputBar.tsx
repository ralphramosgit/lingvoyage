import { Keyboard, Lightbulb, type LucideIcon, Mic, RotateCcw, SendHorizontal, Square, X } from 'lucide-react-native';
import { type ReactNode, type Ref, useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, type TextInputInstance, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  type SharedValue,
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

/**
 * idle: ready, tap to talk. starting: opening the mic. recording: listening, tap to stop.
 * checking: the recording is being transcribed. review: the learner checks the words, tap to send.
 * waiting: the character is answering. locked: the encounter is over.
 */
export type MicState = 'idle' | 'starting' | 'recording' | 'checking' | 'review' | 'waiting' | 'locked';

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `0:${String(Math.min(seconds, 59)).padStart(2, '0')}`;
}

function MicButton({
  state,
  canSend,
  level,
  onPress,
}: {
  state: MicState;
  canSend: boolean;
  level: SharedValue<number>;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const recording = state === 'recording';

  useEffect(() => {
    if (recording && !reduceMotion) {
      pulse.set(0);
      pulse.set(withRepeat(withTiming(1, { duration: 1100 }), -1, false));
    } else {
      cancelAnimation(pulse);
      pulse.set(0);
    }
  }, [recording, reduceMotion, pulse]);

  // An expanding halo that keeps going while recording...
  const haloStyle = useAnimatedStyle(() => ({
    opacity: recording ? (reduceMotion ? 0.35 : 0.45 * (1 - pulse.get())) : 0,
    transform: [{ scale: reduceMotion ? 1.2 : 1 + pulse.get() * 0.55 }],
  }));
  // ...and a ring that grows with your voice, so you can see the mic hearing you.
  const levelStyle = useAnimatedStyle(() => ({
    opacity: recording ? 0.3 + level.get() * 0.3 : 0,
    transform: [{ scale: 1.06 + level.get() * 0.32 }],
  }));

  const disabled =
    state === 'starting' || state === 'checking' || state === 'waiting' || state === 'locked' || (state === 'review' && !canSend);
  let look: ViewStyle | null = null;
  if (state === 'recording') look = styles.micRecording;
  else if (state === 'starting') look = styles.micStarting;
  else if (state === 'checking' || (state === 'review' && canSend)) look = styles.micSend;
  else if (state !== 'idle') look = styles.micDisabled;

  let label = 'Start recording';
  if (state === 'recording') label = 'Stop recording';
  else if (state === 'starting') label = 'Starting the microphone';
  else if (state === 'checking') label = 'Checking what you said';
  else if (state === 'review') label = canSend ? 'Send' : 'Send, unavailable';
  else if (state === 'waiting') label = 'Microphone, waiting for a reply';
  else if (state === 'locked') label = 'Microphone, encounter complete';

  let icon: ReactNode;
  if (state === 'recording') icon = <Square size={26} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />;
  else if (state === 'review') icon = <SendHorizontal size={30} color={canSend ? '#FFFFFF' : colors.inkMuted} strokeWidth={2.4} />;
  else if (state === 'checking') icon = <ActivityIndicator color="#FFFFFF" />;
  else if (state === 'starting' || state === 'waiting') {
    icon = <ActivityIndicator color={state === 'starting' ? colors.ink : colors.inkMuted} />;
  } else icon = <Mic size={32} color={state === 'locked' ? colors.inkMuted : colors.ink} strokeWidth={2.4} />;

  return (
    <View style={styles.micWrap}>
      <Animated.View pointerEvents="none" style={[styles.micRing, haloStyle]} />
      <Animated.View pointerEvents="none" style={[styles.micRing, levelStyle]} />
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={state === 'idle' ? "Tap, speak, then tap again. You'll see the words before sending." : undefined}
        accessibilityState={{ disabled, busy: state === 'starting' || state === 'checking' || state === 'waiting' }}
        style={[styles.mic, look]}>
        {icon}
      </PressableScale>
    </View>
  );
}

/** A side button with a word under it, for actions an icon alone doesn't explain. */
function SideAction({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <View style={styles.sideAction}>
      <IconButton icon={icon} accessibilityLabel={label} onPress={onPress} variant="surface" />
      <Text variant="tiny" color={colors.inkMuted} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
    </View>
  );
}

function micStatusText(state: MicState, waitingFor: string, canSend: boolean): string {
  switch (state) {
    case 'idle':
      return 'Tap the mic to speak';
    case 'starting':
      return 'Starting the mic...';
    case 'recording':
      return "Listening. Tap the square when you're done";
    case 'checking':
      return 'Checking what you said...';
    case 'review':
      return canSend ? 'Tap send, or re-record to try again' : 'Re-record to try again';
    case 'waiting':
      return `Waiting for ${waitingFor}...`;
    case 'locked':
      return 'Encounter complete';
  }
}

export type InputMode = 'voice' | 'text';

export function InputBar({
  mode,
  onModeChange,
  busy,
  locked,
  micState,
  micLevel,
  waitingFor,
  elapsedMs,
  maxMs,
  onMicPress,
  onCancelRecording,
  transcript,
  canSendVoice,
  onSendVoice,
  onRerecord,
  onDiscardVoice,
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
  micState: MicState;
  /** Mic loudness, 0 to 1. */
  micLevel: SharedValue<number>;
  /** Who the learner is waiting on while a request is in flight, e.g. the character's name. */
  waitingFor: string;
  elapsedMs: number;
  maxMs: number;
  onMicPress: () => void;
  onCancelRecording: () => void;
  /** What the mic heard (live captions, then the words to check), shown above the mic. */
  transcript: ReactNode;
  /** In review, the words are ready to send. */
  canSendVoice: boolean;
  onSendVoice: () => void;
  onRerecord: () => void;
  onDiscardVoice: () => void;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  suggestionsOn: boolean;
  onToggleSuggestions: () => void;
  hint: string | null;
  bottomInset: number;
  inputRef: Ref<TextInputInstance>;
}) {
  const disabled = busy || locked;
  const recording = micState === 'recording';
  const reviewing = micState === 'checking' || micState === 'review';
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
        <>
          {transcript}
          <View style={styles.voiceRow}>
            <View style={styles.side}>
              {recording ? (
                <IconButton icon={X} accessibilityLabel="Cancel recording" onPress={onCancelRecording} variant="surface" />
              ) : reviewing ? (
                <SideAction icon={X} label="Discard" onPress={onDiscardVoice} />
              ) : (
                <IconButton
                  icon={Keyboard}
                  accessibilityLabel="Switch to typing"
                  onPress={() => onModeChange('text')}
                  variant="surface"
                  disabled={locked || micState === 'starting'}
                />
              )}
            </View>

            <MicButton
              state={micState}
              canSend={canSendVoice}
              level={micLevel}
              onPress={micState === 'review' ? onSendVoice : onMicPress}
            />

            <View style={[styles.side, styles.sideRight]}>
              {reviewing ? (
                <SideAction icon={RotateCcw} label="Re-record" onPress={onRerecord} />
              ) : recording ? (
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
          <Text
            variant="label"
            align="center"
            color={recording ? colors.danger : colors.inkMuted}
            numberOfLines={1}
            style={styles.micStatus}
            accessibilityLiveRegion="polite">
            {micStatusText(micState, waitingFor, canSendVoice)}
          </Text>
        </>
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
  sideAction: { alignItems: 'center', gap: 2, minWidth: 64 },
  micWrap: { width: MIC_SIZE + 24, height: MIC_SIZE + 24, alignItems: 'center', justifyContent: 'center' },
  micRing: {
    position: 'absolute',
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: colors.danger,
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
  micRecording: { backgroundColor: colors.danger, shadowColor: colors.danger, shadowOpacity: 0.35 },
  micSend: { backgroundColor: colors.sky600, shadowColor: colors.sky600, shadowOpacity: 0.3 },
  micStarting: { backgroundColor: colors.sun300 },
  micDisabled: { backgroundColor: '#E8EDF2', shadowOpacity: 0, elevation: 0 },
  micStatus: { marginTop: -spacing.xs },
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
