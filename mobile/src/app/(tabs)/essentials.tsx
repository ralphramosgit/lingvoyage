import { type Href, router } from 'expo-router';
import { AudioLines, BookA, type LucideIcon, Puzzle, ScrollText, Table2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SectionCard } from '@/components/essentials/SectionCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors, motion, spacing, type TintName } from '@/theme/theme';

type Section = { title: string; description: string; icon: LucideIcon; tint: TintName; href: Href };

const SECTIONS: Section[] = [
  {
    title: 'Pinyin & pronunciation',
    description: 'The four tones and the sounds that differ from English.',
    icon: AudioLines,
    tint: 'sky',
    href: '/essentials/pinyin',
  },
  {
    title: 'Vocabulary',
    description: 'Beginner words grouped by type.',
    icon: BookA,
    tint: 'mint',
    href: '/essentials/vocabulary',
  },
  {
    title: 'Grammar',
    description: 'The most common sentence patterns, one at a time.',
    icon: Puzzle,
    tint: 'sun',
    href: '/essentials/grammar',
  },
  {
    title: 'Tables',
    description: 'Numbers, pronouns and more, to scan at a glance.',
    icon: Table2,
    tint: 'sky',
    href: '/essentials/tables',
  },
  {
    title: 'Cheat sheets',
    description: 'One-screen summaries to review right before a trip.',
    icon: ScrollText,
    tint: 'mint',
    href: '/essentials/cheatsheets',
  },
];

export default function EssentialsScreen() {
  return (
    <Screen scroll edges={['top']}>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Essentials
        </Text>
        <Text variant="body" color={colors.inkMuted}>
          The basics to study anytime. Tap a speaker to hear any word.
        </Text>
      </Animated.View>

      <View style={styles.list}>
        {SECTIONS.map((section, index) => (
          <Animated.View key={section.title} entering={FadeInDown.duration(motion.base).delay(motion.stagger * (index + 1))}>
            <SectionCard
              title={section.title}
              description={section.description}
              icon={section.icon}
              tint={section.tint}
              onPress={() => router.push(section.href)}
            />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingTop: spacing.lg, marginBottom: spacing.xl },
  list: { gap: spacing.md },
});
