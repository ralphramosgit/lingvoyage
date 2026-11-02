import { router } from 'expo-router';
import { CarTaxiFront, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ErrorState } from '@/components/ErrorState';
import { FormMessage } from '@/components/FormMessage';
import { LocalEncounters } from '@/components/pack/LocalEncounters';
import { type SceneView, SceneToggle } from '@/components/pack/SceneToggle';
import { PalHero } from '@/components/PalHero';
import { LockedScenarioCard, ScenarioCard } from '@/components/ScenarioCard';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Text } from '@/components/Text';
import { cityName, useCities } from '@/hooks/useCities';
import { useEncounterProgress } from '@/hooks/useEncounterProgress';
import { usePack } from '@/hooks/usePack';
import { useScenarios } from '@/hooks/useScenarios';
import { useAuth } from '@/lib/auth';
import { colors, motion, spacing } from '@/theme/theme';

export default function EncountersScreen() {
  const { profile } = useAuth();
  const { scenarios, loading, reload } = useScenarios();
  const { completedScenarioIds } = useEncounterProgress();
  const { cities } = useCities();
  const cityPack = usePack();
  const [view, setView] = useState<SceneView>('city');
  const name = profile?.display_name?.trim() || 'traveler';

  // With a city pack that has scenes (or is writing its first ones), the learner picks: practise with the
  // city's researched scenes, or the default ones. Without one, the default scenes, as before.
  const cityScenes =
    (cityPack.pack?.encounters.length ?? 0) > 0 || (cityPack.building && cityPack.status?.ready_pack_id === null);
  const toggle = cityPack.city !== null && cityScenes;

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={
        <RefreshControl refreshing={loading && scenarios !== null} onRefresh={reload} tintColor={colors.sky600} />
      }>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
        <PalHero name={name} />
      </Animated.View>

      {toggle && cityPack.city ? (
        <View style={styles.toggle}>
          <SceneToggle city={cityName(cities, cityPack.city)} value={view} onChange={setView} />
        </View>
      ) : null}

      {/* Until the city pack is in, which scenes to show isn't known yet: plain placeholders, not the default scenes. */}
      {cityPack.arriving ? (
        <View style={[styles.list, styles.loading]}>
          {[0, 1, 2].map((key) => (
            <SkeletonCard key={key} />
          ))}
        </View>
      ) : toggle && view === 'city' ? (
        <LocalEncounters completedScenarioIds={completedScenarioIds} />
      ) : (
        <DefaultScenes completedScenarioIds={completedScenarioIds} />
      )}
    </Screen>
  );
}

/** The standard scenes, the same for everyone. */
function DefaultScenes({ completedScenarioIds }: { completedScenarioIds: Set<string> }) {
  const { scenarios, loading, error, reload } = useScenarios();
  return (
    <>
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
              completed={completedScenarioIds.has(scenario.id)}
              onPress={() => router.push({ pathname: '/encounter/[id]', params: { id: scenario.id } })}
            />
          </Animated.View>
        ))}
      </View>

      <Text variant="heading" style={styles.sectionTitle}>
        On the horizon
      </Text>
      <Animated.View
        entering={FadeInDown.duration(motion.base).delay(((scenarios?.length ?? 3) + 1) * motion.stagger)}
        style={styles.list}>
        <LockedScenarioCard title="Shopping at a market" icon={ShoppingBag} />
        <LockedScenarioCard title="Taking a taxi" icon={CarTaxiFront} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md },
  loading: { marginTop: spacing.xxl },
  toggle: { marginTop: spacing.xl },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  list: { gap: spacing.lg },
});
