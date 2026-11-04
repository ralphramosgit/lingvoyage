import { router } from 'expo-router';
import { ChevronLeft, Circle, CircleCheck, ExternalLink, MapPin, RotateCcw, TriangleAlert } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Seagull } from '@/components/art/Seagull';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconButton } from '@/components/IconButton';
import { Pill } from '@/components/Pill';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VoyageLoader } from '@/components/VoyageLoader';
import { cityName, useCities } from '@/hooks/useCities';
import { canRetry, usePack } from '@/hooks/usePack';
import { packSummary, shortDate, STAGES, StepIcon, stepAccessibilityLabel, workerLabel } from '@/lib/packVisuals';
import { playSound } from '@/lib/sounds';
import { openSource } from '@/lib/sources';
import type { PackStatus, PackStep } from '@/types/api';
import { colors, motion, radii, spacing } from '@/theme/theme';

const SOURCES_SHOWN = 8;

type StageState = 'done' | 'active' | 'failed' | 'waiting';

function stageStates(status: PackStatus): Record<string, StageState> {
  const current = STAGES.findIndex((stage) => stage.id === status.stage);
  const states: Record<string, StageState> = {};
  STAGES.forEach((stage, index) => {
    if (status.status === 'ready') states[stage.id] = 'done';
    else if (index < current) states[stage.id] = 'done';
    else if (index === current) states[stage.id] = status.status === 'failed' ? 'failed' : 'active';
    else states[stage.id] = 'waiting';
  });
  return states;
}

/** What the research agent is doing, live while it builds the learner's city pack, and how a ready pack was built. */
export default function PackScreen() {
  const { cities } = useCities();
  const { city, status, pack, error, loading, building, retry } = usePack();
  const [allSources, setAllSources] = useState(false);
  const name = city ? cityName(cities, city) : '';

  // The harp flourish if the pack finishes while you watch it being built, and a low note if it fails.
  const packState = status?.status;
  const working = useRef(false);
  useEffect(() => {
    if (working.current && packState === 'ready') playSound('complete');
    else if (working.current && packState === 'failed') playSound('wrong');
    working.current = packState === 'queued' || packState === 'running';
  }, [packState]);

  const header = (
    <View style={styles.topBar}>
      <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => router.back()} />
      <Text variant="heading" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
        {city ? `Your ${name} pack` : 'Your city pack'}
      </Text>
    </View>
  );

  if (!city || (status === null && !loading)) {
    return (
      <Screen header={header}>
        <View style={styles.empty}>
          <Text variant="body" color={colors.inkMuted} align="center">
            {error ? error.message : 'Set where you\'re going on Profile, and an agent researches your city for you.'}
          </Text>
          {error && canRetry(error) ? <Button label="Try again" icon={RotateCcw} variant="secondary" onPress={retry} /> : null}
          {error?.code === 'city_coming_soon' ? (
            <Button label="Pick another city" icon={MapPin} variant="secondary" onPress={() => router.push('/destination')} />
          ) : (
            <Button label="Go to Profile" variant="ghost" onPress={() => router.navigate('/profile')} />
          )}
        </View>
      </Screen>
    );
  }

  if (status === null) {
    return (
      <Screen header={header}>
        <View style={styles.loader}>
          <VoyageLoader label={`Finding out about ${name}…`} />
        </View>
      </Screen>
    );
  }

  const states = stageStates(status);
  const steps = [...status.steps].reverse(); // newest first
  const researchAgents = new Set(status.steps.filter((step) => step.stage === 'research' && step.worker).map((step) => step.worker));
  const builtOn = pack?.built_at ?? status.steps[status.steps.length - 1]?.t;
  const sources = pack?.sources ?? [];

  return (
    <Screen scroll header={header}>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.intro}>
        {building ? (
          <View style={styles.live}>
            <Seagull pose="fly" size={52} />
            <Pill label="Live: the agent is working now" tone="sun" />
          </View>
        ) : status.status === 'ready' && builtOn ? (
          <Pill label={`How this pack was built, ${shortDate(builtOn)}`} tone="neutral" />
        ) : null}
        <Text variant="body" color={colors.inkMuted}>
          An AI agent researched {name} on the web: getting around, places to go, food and real prices. Every fact keeps
          the page it came from.
        </Text>
      </Animated.View>

      <Card style={styles.stages} accessibilityLabel="Stages">
        {STAGES.map((stage) => {
          const state = states[stage.id];
          const label = stage.id === 'research' && researchAgents.size > 0 ? `${stage.label} · ${researchAgents.size} agents` : stage.label;
          return (
            <View
              key={stage.id}
              style={styles.stageRow}
              accessible
              accessibilityLabel={`${label}: ${state === 'active' ? 'in progress' : state}`}>
              <StageIcon state={state} />
              <Text variant={state === 'active' ? 'bodyStrong' : 'body'} color={state === 'waiting' ? colors.inkMuted : colors.ink}>
                {label}
              </Text>
            </View>
          );
        })}
      </Card>

      {status.status === 'failed' ? (
        <Card style={styles.failure}>
          <Text variant="bodyStrong">{status.error?.message ?? "We couldn't build this pack."}</Text>
          {canRetry(error) || !error ? <Button label="Try again" icon={RotateCcw} variant="secondary" size="md" onPress={retry} loading={loading} /> : null}
        </Card>
      ) : null}

      {status.status === 'ready' && pack ? (
        <Card style={styles.summary}>
          <Text variant="subheading">{packSummary(pack)}</Text>
          <Text variant="caption" color={colors.inkMuted}>
            {status.counts.facts} facts · {status.counts.places} places · {status.counts.sources} sources
          </Text>
        </Card>
      ) : null}

      <Text variant="heading" style={styles.sectionTitle}>
        {building ? 'What it’s doing' : 'What it did'}
      </Text>
      <View style={styles.steps}>
        {steps.length === 0 ? (
          <Text variant="caption" color={colors.inkMuted}>
            Starting up…
          </Text>
        ) : null}
        {steps.map((step, index) => (
          <Animated.View key={`${step.t}|${step.worker ?? ''}|${step.text}`} entering={FadeInDown.duration(motion.base).delay(index < 3 ? index * 40 : 0)}>
            <StepRow step={step} />
          </Animated.View>
        ))}
      </View>

      {building ? (
        <Text variant="caption" color={colors.inkMuted} style={styles.counts} accessibilityLiveRegion="polite">
          {status.counts.facts} facts · {status.counts.places} places · {status.counts.sources} sources so far
        </Text>
      ) : null}

      {sources.length > 0 ? (
        <>
          <Text variant="heading" style={styles.sectionTitle}>
            Sources
          </Text>
          <Card padded={false}>
            {(allSources ? sources : sources.slice(0, SOURCES_SHOWN)).map((source, index) => (
              <PressableScale
                key={source.url}
                onPress={() => openSource(source.url)}
                accessibilityRole="link"
                accessibilityLabel={`${source.title}. Opens the page.`}
                style={[styles.sourceRow, index > 0 ? styles.divider : null]}>
                <Text variant="label" style={styles.flex} numberOfLines={2}>
                  {source.title}
                </Text>
                <ExternalLink size={16} color={colors.inkMuted} />
              </PressableScale>
            ))}
          </Card>
          {sources.length > SOURCES_SHOWN && !allSources ? (
            <Button label={`Show all ${sources.length} sources`} variant="ghost" size="md" onPress={() => setAllSources(true)} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function StageIcon({ state }: { state: StageState }) {
  if (state === 'done') return <CircleCheck size={20} color={colors.success} />;
  if (state === 'active') return <ActivityIndicator size="small" color={colors.sky600} style={styles.stageSpinner} />;
  if (state === 'failed') return <TriangleAlert size={20} color={colors.danger} />;
  return <Circle size={20} color={colors.line} />;
}

function StepRow({ step }: { step: PackStep }) {
  const content = (
    <>
      <View style={styles.stepIcon}>
        <StepIcon kind={step.kind} size={16} color={step.kind === 'error' ? colors.danger : colors.sky700} />
      </View>
      <View style={styles.flex}>
        {step.worker ? (
          <Text variant="tiny" color={colors.inkMuted}>
            {workerLabel(step.worker)}
          </Text>
        ) : null}
        <Text variant={step.kind === 'stage' ? 'bodyStrong' : 'label'} color={colors.ink}>
          {step.kind === 'search' ? `“${step.text}”` : step.text}
        </Text>
      </View>
    </>
  );
  if (step.url) {
    return (
      <PressableScale
        onPress={() => openSource(step.url ?? '')}
        accessibilityRole="link"
        accessibilityLabel={`${stepAccessibilityLabel(step)}. Opens the page.`}
        style={styles.stepRow}>
        {content}
      </PressableScale>
    );
  }
  return (
    <View style={styles.stepRow} accessible accessibilityLabel={stepAccessibilityLabel(step)}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  empty: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg },
  loader: { marginTop: spacing.xxxl },
  live: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  intro: { gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg, alignItems: 'flex-start' },
  stages: { gap: spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 24 },
  stageSpinner: { width: 20, height: 20 },
  failure: { gap: spacing.md, marginTop: spacing.md },
  summary: { gap: spacing.xs, marginTop: spacing.md },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  steps: { gap: spacing.sm },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.sky50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counts: { marginTop: spacing.md },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
});
