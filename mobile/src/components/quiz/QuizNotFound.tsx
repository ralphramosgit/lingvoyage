import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors, spacing } from '@/theme/theme';

/** For a link to a quiz that isn't in the content anymore, or has no questions yet. */
export function QuizNotFound() {
  return (
    <Screen
      header={
        <View style={styles.backRow}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/quiz'))}
            variant="surface"
            iconSize={22}
          />
        </View>
      }
      contentStyle={styles.center}>
      <Text variant="body" align="center" color={colors.inkMuted}>
        This quiz isn&apos;t available anymore.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'stretch' },
  backRow: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
});
