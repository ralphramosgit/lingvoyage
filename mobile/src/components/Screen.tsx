import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme/theme';

export type ScreenProps = PropsWithChildren<{
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Safe-area edges to pad. Defaults to top and bottom. */
  edges?: Edge[];
  background?: string;
  /** Avoid the keyboard (iOS padding behavior). */
  keyboard?: boolean;
  /** Rendered above the content, inside the safe area and max width. */
  header?: ReactNode;
  /** Rendered below the content (e.g. a sticky button), inside the safe area and max width. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  padded?: boolean;
}>;

/** Safe area + centered column (max 640 wide) so layouts hold from iPhone SE to iPad. */
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  background = colors.bg,
  keyboard = false,
  header,
  footer,
  contentStyle,
  refreshControl,
  padded = true,
}: ScreenProps) {
  const column = [styles.column, padded ? styles.padded : null];

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, column, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, column, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {header ? <View style={column}>{header}</View> : null}
      {body}
      {footer ? <View style={column}>{footer}</View> : null}
    </>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: background }]}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  padded: { paddingHorizontal: layout.screenPadding },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxxl },
});
