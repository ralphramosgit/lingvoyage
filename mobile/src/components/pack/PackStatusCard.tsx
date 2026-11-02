import { router } from 'expo-router';
import { ChevronRight, MapPin, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { cityName, useCities } from '@/hooks/useCities';
import { canRetry, usePack } from '@/hooks/usePack';
import { packSummary } from '@/lib/packVisuals';
import { colors, motion, radii, spacing, tints } from '@/theme/theme';

/**
 * The learner's city pack, at the top of the Encounters tab: set a destination, the agent building it
 * (only while a run is really going), ready, or what went wrong. Everything else in the app works
 * the same whatever this says.
 */
export function PackStatusCard() {
  const { cities } = useCities();
  const { city, status, pack, error, loading, building, justFinished, retry, dismissFinished } = usePack();

  if (!city) {
    return (
      <Card
        onPress={() => router.push('/destination')}
        accessibilityLabel="Where are you going? Set your destination to get lessons and scenes for your city."
        style={styles.row}>
        <View style={[styles.icon, { backgroundColor: tints.sun.bg }]}>
          <MapPin size={22} color={tints.sun.fg} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">Where are you going?</Text>
          <Text variant="caption" color={colors.inkMuted}>
            Set your destination to get lessons and scenes for your city.
          </Text>
        </View>
        <ChevronRight size={20} color={colors.inkMuted} />
      </Card>
    );
  }

  const name = cityName(cities, city);

  if (status === null && loading) {
    return (
      <Card style={styles.row} accessibilityLabel={`Checking your ${name} pack`}>
        <ActivityIndicator color={colors.sky600} />
        <Text variant="bodyMedium" color={colors.inkMuted}>
          Checking your {name} pack…
        </Text>
      </Card>
    );
  }

  if (status === null && error) {
    const paused = error.code === 'packs_paused';
    return (
      <Card style={styles.column}>
        <Text variant="subheading">{paused ? `${name} isn't ready yet` : `We couldn't check your ${name} pack`}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {error.message} Your lessons and scenes work as usual.
        </Text>
        <View style={styles.actions}>
          {canRetry(error) ? (
            <Button label="Try again" icon={RotateCcw} variant="secondary" size="md" onPress={retry} loading={loading} />
          ) : null}
          <Button label="Change city" variant="ghost" size="md" onPress={() => router.push('/destination')} />
        </View>
      </Card>
    );
  }

  if (building && status) {
    const latest = status.steps[status.steps.length - 1];
    const title = status.refreshing ? `Updating your ${name} pack…` : `Building your ${name} pack…`;
    return (
      <Card
        onPress={() => router.push('/pack')}
        accessibilityLabel={`${title} ${latest ? latest.text : ''}. See what it's doing.`}
        style={styles.column}>
        <View style={styles.titleRow}>
          <ActivityIndicator color={colors.sky600} />
          <Text variant="subheading" style={styles.flex}>
            {title}
          </Text>
        </View>
        {latest ? (
          <Animated.View key={`${latest.t}${latest.text}`} entering={FadeIn.duration(motion.base)}>
            <Text variant="caption" color={colors.inkMuted} numberOfLines={2}>
              {latest.text}
            </Text>
          </Animated.View>
        ) : null}
        <View style={styles.link}>
          <Text variant="label" color={colors.sky700}>
            See what it&apos;s doing
          </Text>
          <ChevronRight size={16} color={colors.sky700} />
        </View>
      </Card>
    );
  }

  if (status?.status === 'failed') {
    const failure = status.error ?? { code: 'failed', message: 'Something went wrong while building it.' };
    return (
      <Card style={styles.column}>
        <Text variant="subheading">We couldn&apos;t build your {name} pack.</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {failure.message} Your lessons and scenes work as usual.
        </Text>
        <View style={styles.actions}>
          {canRetry(error) || !error ? (
            <Button label="Try again" icon={RotateCcw} variant="secondary" size="md" onPress={retry} loading={loading} />
          ) : null}
          <Button label="See what happened" variant="ghost" size="md" onPress={() => router.push('/pack')} />
        </View>
        {error ? (
          <Text variant="caption" color={colors.danger}>
            {error.message}
          </Text>
        ) : null}
      </Card>
    );
  }

  if (status?.status === 'ready' && justFinished) {
    return (
      <Card style={[styles.row, styles.ready]}>
        <View style={[styles.icon, { backgroundColor: tints.mint.bg }]}>
          <Sparkles size={22} color={tints.mint.fg} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">Your {name} pack is ready</Text>
          <Text variant="caption" color={colors.inkMuted}>
            {pack ? packSummary(pack) : `${status.counts.facts} facts from ${status.counts.sources} sources`}
          </Text>
        </View>
        <IconButton icon={X} accessibilityLabel="Dismiss" onPress={dismissFinished} />
      </Card>
    );
  }

  if (status?.status === 'ready') {
    return (
      <Card
        onPress={() => router.push('/pack')}
        accessibilityLabel={`Your ${name} pack: ${status.counts.facts} facts from ${status.counts.sources} sources. See how it was built.`}
        style={styles.row}>
        <View style={[styles.icon, { backgroundColor: tints.sky.bg }]}>
          <MapPin size={22} color={tints.sky.fg} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Your {name} pack</Text>
          <Text variant="caption" color={colors.inkMuted}>
            {status.counts.facts} facts from {status.counts.sources} sources
          </Text>
        </View>
        <ChevronRight size={20} color={colors.inkMuted} />
      </Card>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  column: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  ready: { borderColor: tints.mint.bg },
});
