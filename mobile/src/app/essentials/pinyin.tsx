import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { EssentialsPage } from '@/components/essentials/EssentialsPage';
import { SoundRow } from '@/components/essentials/SoundRow';
import { Text } from '@/components/Text';
import { PINYIN } from '@/content/essentials/pinyin';
import type { Sound } from '@/content/essentials/types';
import { colors, spacing } from '@/theme/theme';

export default function PinyinScreen() {
  return (
    <EssentialsPage eyebrow="Essentials" title="Pinyin & pronunciation" subtitle={PINYIN.intro} backLabel="Back to Essentials">
      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          The tones
        </Text>
        <Card padded={false}>
          {PINYIN.tones.map((tone, index) => (
            <SoundRow
              key={tone.number}
              badge={tone.number === 5 ? '·' : String(tone.number)}
              title={tone.name}
              howItSounds={tone.howItSounds}
              example={tone.example}
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

function SoundSection({ title, caption, sounds }: { title: string; caption: string; sounds: Sound[] }) {
  return (
    <View style={styles.section}>
      <View>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="caption" color={colors.inkMuted}>
          {caption}
        </Text>
      </View>
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
});
