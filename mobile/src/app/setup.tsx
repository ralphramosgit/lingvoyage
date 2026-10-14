import { Check, Lock, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { Pill } from '@/components/Pill';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, motion, radii, shadows, spacing } from '@/theme/theme';

type LanguageOption = {
  code: string;
  name: string;
  native: string;
  romanized?: string;
  available: boolean;
};

const LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', name: 'Mandarin Chinese', native: '中文', romanized: 'Pǔtōnghuà', available: true },
  { code: 'ja', name: 'Japanese', native: '日本語', available: false },
  { code: 'ko', name: 'Korean', native: '한국어', available: false },
  { code: 'es', name: 'Spanish', native: 'Español', available: false },
  { code: 'fr', name: 'French', native: 'Français', available: false },
];

type StepKey = 'language';
// One step today; more (e.g. travel goals: food, sights, culture) slot in here later.
const STEPS: StepKey[] = ['language'];

export default function SetupScreen() {
  const { session, refreshProfile, signOut } = useAuth();
  const [stepIndex] = useState(0);
  const [language, setLanguage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const canContinue = step === 'language' ? language !== null : true;

  const finish = async () => {
    if (!session || !language) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ target_language: language, onboarding_complete: true })
      .eq('id', session.user.id);
    if (updateError) {
      setError("We couldn't save your choice. Check your connection and try again.");
      setSaving(false);
      return;
    }
    // The router guard moves the user into the tabs once the profile says onboarding is done.
    await refreshProfile();
  };

  return (
    <Screen
      scroll
      header={
        <View style={styles.topBar}>
          <View style={styles.progressBlock}>
            <Text variant="tiny" color={colors.inkMuted}>
              STEP {stepIndex + 1} OF {STEPS.length}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((stepIndex + 1) / STEPS.length) * 100}%` }]} />
            </View>
          </View>
          <PressableScale
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={styles.logout}>
            <LogOut size={16} color={colors.inkMuted} />
            <Text variant="label" color={colors.inkMuted}>
              Log out
            </Text>
          </PressableScale>
        </View>
      }
      footer={
        <View style={styles.footer}>
          {error ? <FormMessage message={error} /> : null}
          <Button
            label={isLastStep ? 'Continue' : 'Next'}
            onPress={finish}
            disabled={!canContinue}
            loading={saving}
            accessibilityHint={canContinue ? undefined : 'Choose a language first'}
          />
        </View>
      }>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Which language are you learning?
        </Text>
        <Text variant="body" color={colors.inkMuted}>
          You can add more languages later.
        </Text>
      </Animated.View>

      <View style={styles.list} accessibilityRole="radiogroup">
        {LANGUAGES.map((option, index) => (
          <Animated.View key={option.code} entering={FadeInDown.duration(motion.base).delay(80 + index * motion.stagger)}>
            <LanguageCard
              option={option}
              selected={language === option.code}
              onSelect={() => setLanguage(option.code)}
            />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

function LanguageCard({
  option,
  selected,
  onSelect,
}: {
  option: LanguageOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = !option.available;
  return (
    <PressableScale
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={disabled ? `${option.name}, coming soon` : option.name}
      accessibilityState={{ selected, disabled }}
      style={[styles.card, selected ? styles.cardSelected : null, disabled ? styles.cardDisabled : null]}>
      <View style={[styles.nativeTile, selected ? styles.nativeTileSelected : null]}>
        <Text variant="subheading" color={disabled ? colors.inkMuted : colors.sky700} numberOfLines={1} adjustsFontSizeToFit>
          {option.native}
        </Text>
      </View>
      <View style={styles.cardText}>
        <Text variant="subheading" color={disabled ? colors.inkMuted : colors.ink}>
          {option.name}
        </Text>
        {option.romanized ? (
          <Text variant="caption" color={colors.inkMuted}>
            {option.native} · {option.romanized}
          </Text>
        ) : null}
        {disabled ? <Pill label="Coming soon" tone="neutral" style={styles.soonPill} /> : null}
      </View>
      {disabled ? (
        <Lock size={20} color={colors.inkMuted} />
      ) : (
        <Animated.View layout={LinearTransition.duration(motion.fast)} style={[styles.radio, selected ? styles.radioSelected : null]}>
          {selected ? (
            <Animated.View entering={ZoomIn.duration(motion.base)}>
              <Check size={16} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressBlock: { flex: 1, gap: spacing.sm, maxWidth: 220 },
  progressTrack: { height: 6, borderRadius: radii.full, backgroundColor: colors.sky100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.full, backgroundColor: colors.sky500 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 44, paddingHorizontal: spacing.sm },
  header: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xxl },
  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    minHeight: 76,
    ...shadows.card,
  },
  cardSelected: { borderColor: colors.sky500, backgroundColor: colors.sky50 },
  cardDisabled: { backgroundColor: '#F8FAFC', shadowOpacity: 0, elevation: 0 },
  nativeTile: {
    width: 56,
    height: 56,
    borderRadius: radii.input,
    backgroundColor: colors.sky50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  nativeTileSelected: { backgroundColor: colors.sky100 },
  cardText: { flex: 1, gap: 2 },
  soonPill: { marginTop: spacing.xs },
  radio: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.sky600, borderColor: colors.sky600 },
  footer: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
});
