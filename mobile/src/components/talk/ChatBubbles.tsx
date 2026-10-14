import { CircleAlert, Info, Languages, Lightbulb, Mic, RotateCcw, Turtle, Volume2, VolumeX } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { CharacterAvatar } from '@/components/CharacterAvatar';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import type { ErrorMessage, LearnerMessage, NoticeMessage, NpcMessage } from '@/hooks/useConversation';
import { playUri, SLOW_RATE, usePlayback } from '@/lib/audio';
import { colors, motion, radii, shadows, spacing, type TintName } from '@/theme/theme';

const BUBBLE_MAX_WIDTH = '84%';

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export function NpcBubble({
  message,
  avatarChar,
  tint,
  showPinyin,
  englishVisible,
  onToggleEnglish,
}: {
  message: NpcMessage;
  avatarChar: string;
  tint: TintName;
  showPinyin: boolean;
  englishVisible: boolean;
  onToggleEnglish: () => void;
}) {
  const { reply, audioUri, id } = message;
  const { playingKey } = usePlayback();
  const normalKey = `line:${id}`;
  const slowKey = `line-slow:${id}`;

  const replay = (slow: boolean) => {
    if (!audioUri) return;
    playUri(audioUri, { rate: slow ? SLOW_RATE : 1, key: slow ? slowKey : normalKey }).catch(() => undefined);
  };

  return (
    <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.npcRow}>
      <CharacterAvatar char={avatarChar} size={34} tint={tint} />
      <View style={[styles.bubble, styles.npcBubble]}>
        <Text variant="hanziLarge" selectable>
          {reply.hanzi}
        </Text>
        {showPinyin && reply.pinyin ? (
          <Text variant="bodyMedium" color={colors.inkMuted} selectable>
            {reply.pinyin}
          </Text>
        ) : null}

        {englishVisible ? (
          <Animated.View entering={FadeIn.duration(motion.fast)}>
            <Text variant="body" style={styles.english}>
              {reply.english}
            </Text>
          </Animated.View>
        ) : (
          <PressableScale
            onPress={onToggleEnglish}
            accessibilityRole="button"
            accessibilityLabel="Show translation"
            style={styles.showTranslation}>
            <Text variant="label" color={colors.sky700}>
              Show translation
            </Text>
          </PressableScale>
        )}

        {message.voiceUnavailable ? (
          <View style={styles.voiceNote}>
            <VolumeX size={14} color={colors.inkMuted} />
            <Text variant="tiny" color={colors.inkMuted}>
              Voice unavailable
            </Text>
          </View>
        ) : null}

        <View style={styles.npcActions}>
          <IconButton
            icon={Volume2}
            accessibilityLabel="Replay"
            onPress={() => replay(false)}
            disabled={!audioUri}
            size={36}
            iconSize={18}
            variant={playingKey === normalKey ? 'primary' : 'tinted'}
            active={playingKey === normalKey}
          />
          <IconButton
            icon={Turtle}
            accessibilityLabel="Replay slowly"
            onPress={() => replay(true)}
            disabled={!audioUri}
            size={36}
            iconSize={18}
            variant={playingKey === slowKey ? 'primary' : 'tinted'}
            active={playingKey === slowKey}
          />
          <IconButton
            icon={Languages}
            accessibilityLabel={englishVisible ? 'Hide translation' : 'Show translation'}
            onPress={onToggleEnglish}
            size={36}
            iconSize={18}
            variant={englishVisible ? 'primary' : 'tinted'}
            active={englishVisible}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Learner
// ---------------------------------------------------------------------------

export function LearnerBubble({ message }: { message: LearnerMessage }) {
  const transcribing = message.source === 'voice' && message.text === null;
  return (
    <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.learnerColumn}>
      <View style={[styles.bubble, styles.learnerBubble, message.failed ? styles.learnerFailed : null]}>
        {message.source === 'voice' ? (
          <View style={styles.voiceLabel}>
            <Mic size={12} color={colors.sky700} />
            <Text variant="tiny" color={colors.sky700}>
              {transcribing ? 'Sending your voice' : 'You said'}
            </Text>
            {transcribing && message.pending ? <ActivityIndicator size="small" color={colors.sky700} /> : null}
          </View>
        ) : null}
        {message.text !== null ? (
          <Text variant="hanzi" style={styles.learnerText} selectable>
            {message.text}
          </Text>
        ) : (
          <Text variant="body" color={colors.inkMuted}>
            {message.failed ? 'Voice message not sent' : '...'}
          </Text>
        )}
      </View>
      {message.feedback ? <FeedbackCard feedback={message.feedback} /> : null}
    </Animated.View>
  );
}

function FeedbackCard({ feedback }: { feedback: NonNullable<LearnerMessage['feedback']> }) {
  return (
    <Animated.View entering={FadeInDown.duration(motion.base).delay(120)} style={styles.feedback}>
      {feedback.feedback ? (
        <View style={styles.feedbackRow}>
          <Lightbulb size={18} color="#A16207" />
          <Text variant="caption" color={colors.ink} style={styles.flex}>
            {feedback.feedback}
          </Text>
        </View>
      ) : null}
      {feedback.corrected_hanzi ? (
        <View style={[styles.correction, feedback.feedback ? styles.correctionDivider : null]}>
          <View style={styles.flex}>
            <Text variant="tiny" color="#854D0E">
              TRY IT LIKE THIS
            </Text>
            <Text variant="hanzi" selectable>
              {feedback.corrected_hanzi}
            </Text>
            {feedback.corrected_pinyin ? (
              <Text variant="caption" color={colors.inkMuted}>
                {feedback.corrected_pinyin}
              </Text>
            ) : null}
          </View>
          <SpeakerButton text={feedback.corrected_hanzi} label="Play the corrected line" size={36} />
        </View>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Thinking, errors, notices
// ---------------------------------------------------------------------------

function Dot({ index }: { index: number }) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    offset.set(
      withDelay(
        index * 120,
        withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 })), -1, false),
      ),
    );
  }, [index, offset, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function ThinkingBubble({ avatarChar, tint, name }: { avatarChar: string; tint: TintName; name: string }) {
  return (
    <Animated.View
      entering={FadeIn.duration(motion.fast)}
      style={styles.npcRow}
      accessible
      accessibilityLabel={`${name} is thinking`}
      accessibilityLiveRegion="polite">
      <CharacterAvatar char={avatarChar} size={34} tint={tint} />
      <View style={[styles.bubble, styles.npcBubble, styles.thinking]}>
        <Dot index={0} />
        <Dot index={1} />
        <Dot index={2} />
      </View>
    </Animated.View>
  );
}

export function ErrorRow({ message, onRetry, disabled }: { message: ErrorMessage; onRetry: () => void; disabled: boolean }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={styles.errorRow} accessibilityRole="alert">
      <CircleAlert size={18} color={colors.danger} />
      <Text variant="caption" color="#991B1B" style={styles.flex}>
        {message.message}
      </Text>
      <Button label="Retry" icon={RotateCcw} size="md" variant="secondary" onPress={onRetry} disabled={disabled} />
    </Animated.View>
  );
}

export function NoticeRow({ message }: { message: NoticeMessage }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={styles.notice} accessibilityLiveRegion="polite">
      <Info size={16} color={colors.inkMuted} />
      <Text variant="caption" color={colors.inkMuted}>
        {message.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  npcRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '100%' },
  bubble: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.card + 2,
    maxWidth: BUBBLE_MAX_WIDTH,
    gap: spacing.xs,
  },
  npcBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: spacing.xs,
    flexShrink: 1,
    ...shadows.card,
  },
  english: { marginTop: spacing.xs },
  showTranslation: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: 2 },
  voiceNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  npcActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  learnerColumn: { alignItems: 'flex-end', gap: spacing.sm },
  learnerBubble: {
    backgroundColor: colors.sky100,
    borderBottomRightRadius: spacing.xs,
  },
  learnerFailed: { opacity: 0.7, borderWidth: 1, borderColor: '#FBD5D5' },
  learnerText: { color: colors.ink },
  voiceLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  feedback: {
    maxWidth: BUBBLE_MAX_WIDTH,
    alignSelf: 'flex-end',
    backgroundColor: colors.sun100,
    borderWidth: 1,
    borderColor: '#FDF0A6',
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  feedbackRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  correction: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  correctionDivider: { borderTopWidth: 1, borderTopColor: '#FDE68A', paddingTop: spacing.sm },
  thinking: { flexDirection: 'row', gap: 6, paddingVertical: spacing.lg, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sky500 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FBD5D5',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
