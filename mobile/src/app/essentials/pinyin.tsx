import { router } from 'expo-router';
import { Grid3x3 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { ReferenceTable } from '@/components/essentials/ReferenceTable';
import { SectionCard } from '@/components/essentials/SectionCard';
import { SoundRow } from '@/components/essentials/SoundRow';
import { ToneContour } from '@/components/essentials/ToneContour';
import { Text } from '@/components/Text';
import { PINYIN } from '@/content/essentials/pinyin';
import type { Sound } from '@/content/essentials/types';
import { colors, spacing } from '@/theme/theme';

const ORDINALS = ['1st', '2nd', '3rd', '4th'] as const;

export default function PinyinScreen() {
  return (
    <EssentialsPage eyebrow="Essentials" title="Pinyin & pronunciation" subtitle={PINYIN.intro} backLabel="Back to Essentials">
      <View style={styles.section}>
        <SectionHeading title="The tones" caption="Each line shows where your voice goes, from low to high." />
        <Card padded={false}>
          {PINYIN.tones.map((tone, index) => (
            <SoundRow
              key={tone.number}
              badge={<ToneContour tone={tone.number} size={32} />}
              title={tone.name}
              howItSounds={tone.howItSounds}
              example={tone.example}
              divider={index > 0}
            />
          ))}
        </Card>
        <SectionCard
          title="Pinyin chart"
          description="Every syllable, with all four tones to hear."
          icon={Grid3x3}
          tint="sun"
          onPress={() => router.push('/essentials/chart')}
        />
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Tone pairs"
          caption="Most words have two syllables. Here is every pairing: each 1st tone with each 2nd, and so on."
        />
        {PINYIN.tonePairs.map((group) => (
          <View key={group.first} style={styles.group}>
            <View style={styles.groupTitle}>
              <ToneContour tone={group.first} size={22} />
              <Text variant="label" color={colors.inkMuted}>
                {`Starting with a ${ORDINALS[group.first - 1]} tone`}
              </Text>
            </View>
            <ReferenceTable rows={group.words} />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeading title="Tone changes" caption="A few tones change when they sit next to others." />
        <Card padded={false}>
          {PINYIN.toneChanges.map((change, index) => (
            <SoundRow
              key={change.label}
              badge={change.label}
              title={change.title}
              howItSounds={change.rule}
              example={change.example}
              divider={index > 0}
            />
          ))}
        </Card>
      </View>

      <SoundSection
        title="Tricky initials"
        caption="The sound at the start of a syllable."
        sounds={PINYIN.initials}
      />
      <SoundSection title="Tricky finals" caption="The rest of the syllable, after the initial." sounds={PINYIN.finals} />
    </EssentialsPage>
  );
}

function SectionHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <View>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="caption" color={colors.inkMuted}>
        {caption}
      </Text>
    </View>
  );
}

function SoundSection({ title, caption, sounds }: { title: string; caption: string; sounds: Sound[] }) {
  return (
    <View style={styles.section}>
      <SectionHeading title={title} caption={caption} />
      <Card padded={false}>
        {sounds.map((sound, index) => (
          <SoundRow
            key={sound.sound}
            badge={sound.sound}
            howItSounds={sound.howItSounds}
            example={sound.example}
            divider={index > 0}
          />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  group: { gap: spacing.sm },
  groupTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
