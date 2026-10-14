import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharacterAvatar } from '@/components/CharacterAvatar';
import { ErrorState } from '@/components/ErrorState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { ErrorRow, LearnerBubble, LiveBubble, NoticeRow, NpcBubble, ThinkingBubble } from '@/components/talk/ChatBubbles';
import { CompleteBar, CompletionSheet } from '@/components/talk/CompletionSheet';
import { GoalsPanel, GoalsPill } from '@/components/talk/Goals';
import { InputBar, type InputMode, type MicState } from '@/components/talk/InputBar';
import { MicPermissionCard } from '@/components/talk/MicPermissionCard';
import { SuggestionsRow } from '@/components/talk/SuggestionsRow';
import { Text } from '@/components/Text';
import { useConversation } from '@/hooks/useConversation';
import { useLiveTranscript } from '@/hooks/useLiveTranscript';
import { useScenario } from '@/hooks/useScenarios';
import { MAX_RECORDING_MS, useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { clearConversationAudio, releasePlayer } from '@/lib/audio';
import { recordEncounter } from '@/lib/progress';
import { scenarioTint } from '@/lib/scenarioVisuals';
import { useSettings } from '@/lib/settings';
import { colors, layout, spacing } from '@/theme/theme';

const HINT_MS = 2500;
const SHEET_DELAY_MS = 900;

export default function TalkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scenario, loading, error, reload } = useScenario(id);
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();

  const conversation = useConversation(scenario, { autoPlay: settings.autoPlay });
  const live = useLiveTranscript();
  const recorder = useVoiceRecorder({ onPcm: live.push });

  const [mode, setMode] = useState<InputMode>('voice');
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [suggestionsPref, setSuggestionsPref] = useState<boolean | null>(null);
  const [englishOverrides, setEnglishOverrides] = useState<Record<string, boolean>>({});
  const [permissionCard, setPermissionCard] = useState<'denied' | 'blocked' | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const started = useRef(false);
  const progressSaved = useRef(false);
  const stopping = useRef(false);
  const previousGoalCount = useRef(0);

  const { start, send, retry, reset, completedGoalIds, complete, thinking, messages, suggestions } = conversation;

  // The character opens the scene as soon as the scenario is known.
  useEffect(() => {
    if (scenario && !started.current) {
      started.current = true;
      void start();
    }
  }, [scenario, start]);

  // Get a live-captions token ready once the scene is underway, so captions start right away.
  const sceneStarted = messages.length > 0;
  const prefetchLiveToken = live.prefetch;
  useEffect(() => {
    if (sceneStarted) prefetchLiveToken();
  }, [sceneStarted, prefetchLiveToken]);

  // Free the shared player and this conversation's audio files when leaving.
  useEffect(
    () => () => {
      releasePlayer();
      clearConversationAudio();
    },
    [],
  );

  // Haptic cheer for every newly completed goal.
  useEffect(() => {
    if (completedGoalIds.length > previousGoalCount.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    previousGoalCount.current = completedGoalIds.length;
  }, [completedGoalIds.length]);

  // Finished: save progress once, then show the sheet after the goodbye line lands.
  useEffect(() => {
    if (!complete || !scenario) return undefined;
    if (!progressSaved.current) {
      progressSaved.current = true;
      recordEncounter({
        scenarioId: scenario.id,
        goalsCompleted: completedGoalIds.length,
        goalsTotal: scenario.goals.length,
        completed: true,
      }).catch(() => {
        // Allow a retry on the next completion if the insert failed.
        progressSaved.current = false;
      });
    }
    Keyboard.dismiss();
    const timer = setTimeout(() => setSheetVisible(true), SHEET_DELAY_MS);
    return () => clearTimeout(timer);
  }, [complete, scenario, completedGoalIds.length]);

  // Short-lived hints like "Hold on a little longer".
  useEffect(() => {
    if (!hint) return undefined;
    const timer = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(timer);
  }, [hint]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const leave = useCallback(() => {
    const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));
    if (conversation.hasProgress && !complete) {
      Alert.alert('Leave this encounter?', "Your conversation so far won't be saved.", [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: exit },
      ]);
    } else {
      exit();
    }
  }, [conversation.hasProgress, complete]);

  // Android back button closes the summary first, then gets the same confirmation as the
  // header button (iOS swipe-back is off for this screen).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetVisible) setSheetVisible(false);
      else leave();
      return true;
    });
    return () => subscription.remove();
  }, [leave, sheetVisible]);

  const stopAndSend = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const preview = live.end();
      const result = await recorder.finish('send');
      if (result.status === 'too_short') setHint('Hold on a little longer');
      else if (result.status === 'error') setHint(result.message);
      else if (result.status === 'ok') await send({ type: 'audio', base64: result.base64, mime: result.mime, preview });
    } finally {
      stopping.current = false;
    }
  }, [live, recorder, send]);

  // Auto-stop (and send) at 30 seconds.
  useEffect(() => {
    if (recorder.isRecording && recorder.elapsedMs >= MAX_RECORDING_MS) void stopAndSend();
  }, [recorder.isRecording, recorder.elapsedMs, stopAndSend]);

  const onMicPress = async () => {
    if (recorder.isRecording) {
      await stopAndSend();
      return;
    }
    if (recorder.status !== 'idle' || thinking || complete) return;
    setHint(null);
    const result = await recorder.start();
    if (result === 'denied' || result === 'blocked') setPermissionCard(result);
    else if (result === 'error') setHint("Couldn't start the microphone. Try again or type it.");
    else if (result === 'streaming' || result === 'recording') {
      setPermissionCard(null);
      if (result === 'streaming') live.begin();
      else live.markUnavailable();
    }
  };

  const onCancelRecording = () => {
    live.end();
    void recorder.finish('cancel');
  };

  const onSendText = async () => {
    const text = draft.trim();
    if (!text || thinking || complete) return;
    setDraft('');
    await send({ type: 'text', text });
  };

  const onUseSuggestion = (text: string) => {
    setDraft(text);
    setMode('text');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const practiceAgain = () => {
    setSheetVisible(false);
    setEnglishOverrides({});
    setSuggestionsPref(null);
    setGoalsOpen(false);
    setDraft('');
    progressSaved.current = false;
    previousGoalCount.current = 0;
    reset();
    void start();
  };

  if (!scenario) {
    return (
      <Screen
        header={
          <View style={styles.headerRow}>
            <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => router.back()} variant="surface" iconSize={22} />
          </View>
        }
        contentStyle={styles.center}>
        {loading ? <ActivityIndicator color={colors.sky600} size="large" /> : null}
        {error ? <ErrorState title="Couldn't load this encounter" message={error} onRetry={reload} /> : null}
      </Screen>
    );
  }

  const tint = scenarioTint(scenario.id);
  const { character } = scenario;
  const suggestionsOn = suggestionsPref ?? conversation.learnerCount < 2;
  const showSuggestions = suggestionsOn && suggestions.length > 0 && !complete && !recorder.isRecording;

  let micState: MicState = 'idle';
  if (recorder.status === 'recording') micState = 'recording';
  else if (recorder.status === 'starting') micState = 'starting';
  else if (complete) micState = 'locked';
  else if (thinking) micState = 'waiting';

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={[styles.column, styles.headerRow]}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Leave encounter" onPress={leave} iconSize={24} color={colors.ink} />
          <CharacterAvatar char={character.avatar_char} size={40} tint={tint} />
          <View style={styles.headerText}>
            <Text variant="subheading" numberOfLines={1}>
              {character.name_hanzi}{' '}
              <Text variant="label" color={colors.inkMuted}>
                {character.name_pinyin}
              </Text>
            </Text>
            <Text variant="tiny" color={colors.inkMuted} numberOfLines={1}>
              {character.role} · {scenario.city}
            </Text>
          </View>
          <GoalsPill
            done={completedGoalIds.length}
            total={scenario.goals.length}
            open={goalsOpen}
            onPress={() => setGoalsOpen((open) => !open)}
          />
        </View>
        <View style={styles.column}>
          <GoalsPanel open={goalsOpen} goals={scenario.goals} completedIds={completedGoalIds} />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Chat */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.column, styles.chat]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((message) => {
            switch (message.kind) {
              case 'npc':
                return (
                  <NpcBubble
                    key={message.id}
                    message={message}
                    avatarChar={character.avatar_char}
                    tint={tint}
                    showPinyin={settings.showPinyin}
                    englishVisible={englishOverrides[message.id] ?? settings.autoEnglish}
                    onToggleEnglish={() =>
                      setEnglishOverrides((current) => ({
                        ...current,
                        [message.id]: !(current[message.id] ?? settings.autoEnglish),
                      }))
                    }
                  />
                );
              case 'learner':
                return <LearnerBubble key={message.id} message={message} showPinyin={settings.showPinyin} />;
              case 'error':
                return <ErrorRow key={message.id} message={message} onRetry={() => retry(message.id)} disabled={thinking} />;
              case 'notice':
                return <NoticeRow key={message.id} message={message} />;
              default:
                return null;
            }
          })}
          {recorder.isRecording ? <LiveBubble text={live.text} status={live.status} /> : null}
          {thinking ? <ThinkingBubble avatarChar={character.avatar_char} tint={tint} name={character.name_english} /> : null}
        </ScrollView>

        {/* Bottom area: the input, or once the encounter is over, the complete bar */}
        {complete ? (
          <View style={styles.inputDock}>
            <View style={styles.column}>
              <CompleteBar
                goalsDone={completedGoalIds.length}
                goalsTotal={scenario.goals.length}
                onShowSummary={() => setSheetVisible(true)}
                onPracticeAgain={practiceAgain}
                onDone={() => router.dismissTo('/')}
                bottomInset={insets.bottom}
              />
            </View>
          </View>
        ) : (
          <View style={styles.bottom}>
            <View style={styles.column}>
              {permissionCard ? (
                <MicPermissionCard
                  blocked={permissionCard === 'blocked'}
                  onDismiss={() => setPermissionCard(null)}
                  onTypeInstead={() => {
                    setPermissionCard(null);
                    setMode('text');
                  }}
                  onTryAgain={() => {
                    setPermissionCard(null);
                    void onMicPress();
                  }}
                />
              ) : null}
              {showSuggestions ? (
                <SuggestionsRow suggestions={suggestions} onUse={onUseSuggestion} onError={setHint} />
              ) : null}
            </View>
            <View style={styles.inputDock}>
              <View style={styles.column}>
                <InputBar
                  mode={mode}
                  onModeChange={(next) => {
                    setMode(next);
                    if (next === 'text') setTimeout(() => inputRef.current?.focus(), 50);
                    else Keyboard.dismiss();
                  }}
                  busy={thinking}
                  locked={complete}
                  micState={micState}
                  micLevel={recorder.level}
                  waitingFor={character.name_english}
                  elapsedMs={recorder.elapsedMs}
                  maxMs={MAX_RECORDING_MS}
                  onMicPress={() => void onMicPress()}
                  onCancelRecording={onCancelRecording}
                  draft={draft}
                  onDraftChange={setDraft}
                  onSend={() => void onSendText()}
                  suggestionsOn={suggestionsOn}
                  onToggleSuggestions={() => setSuggestionsPref(!suggestionsOn)}
                  hint={hint}
                  bottomInset={keyboardOpen ? 0 : insets.bottom}
                  inputRef={inputRef}
                />
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {sheetVisible ? (
        <CompletionSheet
          goals={scenario.goals}
          completedIds={completedGoalIds}
          linesPracticed={conversation.linesPracticed}
          characterName={character.name_english}
          onPracticeAgain={practiceAgain}
          onReview={() => setSheetVisible(false)}
          onBack={() => router.dismissTo('/')}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerText: { flex: 1 },
  chat: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  bottom: { backgroundColor: colors.bg },
  inputDock: { backgroundColor: colors.surface },
});
