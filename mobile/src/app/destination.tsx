import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { DestinationMap } from '@/components/destination/DestinationMap';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, layout, spacing } from '@/theme/theme';

/** Change where you're going (from Profile, or the Encounters tab's card), on the map. Your city pack follows it. */
export default function DestinationScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const current = profile?.destination_city ?? null;

  const choose = async (city: string): Promise<string | null> => {
    if (!session) return "You're signed out. Sign in again to save your destination.";
    if (city !== current) {
      const { error } = await supabase.from('profiles').update({ destination_city: city }).eq('id', session.user.id);
      if (error) return "We couldn't save your destination. Check your connection and try again.";
      // usePack follows the profile, so the new city's pack loads (or starts building) by itself.
      await refreshProfile();
    }
    router.back();
    return null;
  };

  return (
    <Screen
      edges={['top']}
      header={
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => router.back()} />
          <View style={styles.titleBlock}>
            <Text variant="heading" accessibilityRole="header">
              Where are you going?
            </Text>
            <Text variant="caption" color={colors.inkMuted}>
              Tap a pin. Your lessons, quizzes and scenes follow it.
            </Text>
          </View>
        </View>
      }>
      <View style={styles.map}>
        <DestinationMap current={current} onChoose={choose} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.md },
  titleBlock: { flex: 1, gap: 2 },
  // Edge to edge, out of the screen's side padding.
  map: { flex: 1, marginHorizontal: -layout.screenPadding },
});
