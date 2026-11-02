import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScenarioCard } from '@/components/ScenarioCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Text } from '@/components/Text';
import { cityName, useCities } from '@/hooks/useCities';
import { usePack } from '@/hooks/usePack';
import { colors, motion, spacing } from '@/theme/theme';

/**
 * "Made for Chengdu": the encounters an agent wrote at real places in the learner's city (issue #39).
 * Skeletons only while a build is really going; nothing without a destination or a pack.
 */
export function LocalEncounters({ completedScenarioIds }: { completedScenarioIds: Set<string> }) {
  const { cities } = useCities();
  const { city, status, pack, error, building } = usePack();
  if (!city) return null;

  const encounters = pack?.encounters ?? [];
  const writing = building && status?.ready_pack_id === null; // a first build: nothing to show yet
  const fetching = status?.ready_pack_id != null && pack === null && error === null;
  if (encounters.length === 0 && !writing && !fetching) return null;

  const name = cityName(cities, city);
  return (
    <View>
      <Text variant="heading" style={styles.sectionTitle}>
        Made for {name}
      </Text>
      {writing ? (
        <Text variant="caption" color={colors.inkMuted} style={styles.note}>
          Being written from what the agent finds…
        </Text>
      ) : encounters.length > 0 ? (
        <Text variant="caption" color={colors.inkMuted} style={styles.note}>
          Real places in {name}, with real dishes, lines and prices.
        </Text>
      ) : null}
      <View style={styles.list}>
        {encounters.length === 0 ? [0, 1].map((key) => <SkeletonCard key={key} />) : null}
        {encounters.map((scenario, index) => (
          <Animated.View key={scenario.id} entering={FadeInDown.duration(motion.base).delay(index * motion.stagger)}>
            <ScenarioCard
              scenario={scenario}
              completed={completedScenarioIds.has(scenario.id)}
              onPress={() => router.push({ pathname: '/encounter/[id]', params: { id: scenario.id } })}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.xs },
  note: { marginBottom: spacing.md },
  list: { gap: spacing.lg },
});
