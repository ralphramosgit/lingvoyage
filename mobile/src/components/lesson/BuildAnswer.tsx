import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, motion, radii, spacing } from '@/theme/theme';
import type { Tile } from '@/types/api';

type LineState = 'building' | 'right' | 'missed';

const LINE_TILE: Record<LineState, { bg: string; border: string }> = {
  building: { bg: colors.surface, border: colors.line },
  right: { bg: '#F0FDF4', border: colors.success },
  missed: { bg: '#FFFBEB', border: '#FCE7A5' },
};

/** "Build the sentence": tap tiles from the bank into the answer line, tap them again to take them out. */
export function BuildAnswer({
  bank,
  picked,
  state,
  locked,
  showPinyin,
  onPick,
  onUnpick,
}: {
  /** All tiles, shuffled. */
  bank: Tile[];
  /** Bank indexes in the order the learner placed them. */
  picked: number[];
  state: LineState;
  locked: boolean;
  showPinyin: boolean;
  onPick: (bankIndex: number) => void;
  onUnpick: (bankIndex: number) => void;
}) {
  const line = LINE_TILE[state];
  return (
    <View style={styles.container}>
      <View style={styles.answerLine} accessibilityLabel="Your sentence">
        {picked.length === 0 ? (
          <Text variant="caption" color={colors.inkMuted} style={styles.placeholder}>
            Tap the words below in order
          </Text>
        ) : null}
        {picked.map((bankIndex) => (
          <Animated.View key={bankIndex} entering={FadeIn.duration(motion.fast)}>
            <TileButton
              tile={bank[bankIndex]}
              showPinyin={showPinyin}
              disabled={locked}
              colors={line}
              accessibilityHint="Takes this word back out"
              onPress={() => onUnpick(bankIndex)}
            />
          </Animated.View>
        ))}
      </View>

      <View style={styles.bank}>
        {bank.map((tile, bankIndex) => {
          const used = picked.includes(bankIndex);
          return (
            <Animated.View
              key={bankIndex}
              entering={FadeInDown.duration(motion.base).delay(bankIndex * (motion.stagger / 2))}>
              {used ? (
                // Keeps the bank from reflowing while the tile is in the answer line.
                <View style={styles.slot} accessible={false}>
                  <TileFace tile={tile} showPinyin={showPinyin} hidden />
                </View>
              ) : (
                <TileButton
                  tile={tile}
                  showPinyin={showPinyin}
                  disabled={locked}
                  colors={LINE_TILE.building}
                  accessibilityHint="Adds this word to your sentence"
                  onPress={() => onPick(bankIndex)}
                />
              )}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

function TileButton({
  tile,
  showPinyin,
  disabled,
  colors: palette,
  accessibilityHint,
  onPress,
}: {
  tile: Tile;
  showPinyin: boolean;
  disabled: boolean;
  colors: { bg: string; border: string };
  accessibilityHint: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={tile.hanzi === tile.pinyin ? tile.hanzi : `${tile.hanzi}, ${tile.pinyin}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      scaleTo={0.94}
      style={[styles.tile, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <TileFace tile={tile} showPinyin={showPinyin} />
    </PressableScale>
  );
}

function TileFace({ tile, showPinyin, hidden = false }: { tile: Tile; showPinyin: boolean; hidden?: boolean }) {
  const color = hidden ? 'transparent' : undefined;
  return (
    <View style={styles.face}>
      <Text variant="hanziSmall" color={color}>
        {tile.hanzi}
      </Text>
      {showPinyin && tile.pinyin !== tile.hanzi ? (
        <Text variant="tiny" color={color ?? colors.inkMuted}>
          {tile.pinyin}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xxl },
  answerLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 76,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
  },
  placeholder: { paddingHorizontal: spacing.xs },
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  tile: {
    minHeight: 52,
    minWidth: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.input,
    borderWidth: 2,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    minHeight: 52,
    minWidth: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.input,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: 'transparent',
    backgroundColor: '#E9F0F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: { alignItems: 'center' },
});
