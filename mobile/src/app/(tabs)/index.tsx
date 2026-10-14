import { router } from 'expo-router';
import { CarTaxiFront, Languages, ShoppingBag } from 'lucide-react-native';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ErrorState } from '@/components/ErrorState';
import { FormMessage } from '@/components/FormMessage';
import { Pill } from '@/components/Pill';
import { LockedScenarioCard, ScenarioCard } from '@/components/ScenarioCard';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Text } from '@/components/Text';
import { useEncounterProgress } from '@/hooks/useEncounterProgress';
import { useScenarios } from '@/hooks/useScenarios';
import { useAuth } from '@/lib/auth';
import { colors, motion, radii, spacing } from '@/theme/theme';

export default function EncountersScreen() {
  const { profile } = useAuth();
  const { scenarios, loading, error, reload } = useScenarios();
  const { completedScenarioIds } = useEncounterProgress();
  const name = profile?.display_name?.trim() || 'traveler';

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={
        <RefreshControl refreshing={loading && scenarios !== null} onRefresh={reload} tintColor={colors.sky600} />
      }>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
        <View style={styles.greetingRow}>
          <Text variant="title" style={styles.greeting} accessibilityRole="header">
            Nǐ hǎo, {name}
          </Text>
          <View style={styles.nihao}>
            <Text variant="hanzi" style={styles.nihaoText} color={colors.sky700}>
              你好
            </Text>
          </View>
        </View>
        <Text variant="body" color={colors.inkMuted}>
          Pick a scene and start talking.
        </Text>
        <Pill label="Mandarin Chinese" icon={Languages} tone="sky" style={styles.languagePill} />
      </Animated.View>

      <Text variant="heading" style={styles.sectionTitle}>
        Travel scenes
      </Text>

      <View style={styles.list}>
        {scenarios === null && loading ? [0, 1, 2].map((key) => <SkeletonCard key={key} />) : null}

        {scenarios === null && error ? (
          <ErrorState title="Couldn't load encounters" message={error} onRetry={reload} retrying={loading} />
        ) : null}

        {scenarios !== null && error ? <FormMessage message={`Couldn't refresh: ${error}`} /> : null}

        {scenarios?.map((scenario, index) => (
          <Animated.View key={scenario.id} entering={FadeInDown.duration(motion.base).delay(index * motion.stagger)}>
            <ScenarioCard
              scenario={scenario}
              index={index}
              completed={completedScenarioIds.has(scenario.id)}
              onPress={() => router.push({ pathname: '/encounter/[id]', params: { id: scenario.id } })}
            />
          </Animated.View>
        ))}
      </View>

      <Text variant="heading" style={styles.sectionTitle}>
        Coming soon
      </Text>
      <Animated.View
        entering={FadeInDown.duration(motion.base).delay(((scenarios?.length ?? 3) + 1) * motion.stagger)}
        style={styles.list}>
        <LockedScenarioCard title="Shopping at a market" icon={ShoppingBag} />
        <LockedScenarioCard title="Taking a taxi" icon={CarTaxiFront} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingTop: spacing.lg, marginBottom: spacing.sm },
  greetingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  greeting: { flexShrink: 1 },
  nihao: {
    backgroundColor: colors.sky100,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  nihaoText: { fontWeight: '600' },
  languagePill: { marginTop: spacing.xs },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  list: { gap: spacing.md },
});
