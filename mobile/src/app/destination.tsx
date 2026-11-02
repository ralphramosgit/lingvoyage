import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { CityPicker } from '@/components/destination/CityPicker';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, motion, spacing } from '@/theme/theme';

/** Change where you're going (from Profile, or the Encounters tab's card). Your city pack follows it. */
export default function DestinationScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const current = profile?.destination_city ?? null;
  const [city, setCity] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!session || !city) return;
    if (city === current) {
      router.back();
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ destination_city: city }).eq('id', session.user.id);
    if (updateError) {
      setError("We couldn't save your destination. Check your connection and try again.");
      setSaving(false);
      return;
    }
    // usePack follows the profile, so the new city's pack loads (or starts building) by itself.
    await refreshProfile();
    router.back();
  };

  return (
    <Screen
      scroll
      header={
        <View style={styles.topBar}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        </View>
      }
      footer={
        <View style={styles.footer}>
          {error ? <FormMessage message={error} /> : null}
          <Button
            label="Save"
            onPress={save}
            disabled={!city}
            loading={saving}
            accessibilityHint={city ? undefined : 'Choose a city first'}
          />
        </View>
      }>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Where are you going?
        </Text>
        <Text variant="body" color={colors.inkMuted}>
          We&apos;ll tailor your lessons, quizzes and scenes to it.
        </Text>
      </Animated.View>
      <CityPicker selected={city} onSelect={setCity} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  header: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl },
  footer: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
});
