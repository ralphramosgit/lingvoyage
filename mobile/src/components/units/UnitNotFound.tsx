import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors, spacing } from '@/theme/theme';

/** For a link to a unit or lesson that isn't in the content anymore. */
export function UnitNotFound() {
  return (
    <Screen
      header={
        <View style={styles.backRow}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/lessons'))}
            variant="surface"
            iconSize={22}
          />
        </View>
      }
      contentStyle={styles.center}>
      <Text variant="body" align="center" color={colors.inkMuted}>
        This lesson isn&apos;t available anymore.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'stretch' },
  backRow: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
});
