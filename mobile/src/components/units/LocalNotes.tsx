import { Check, ChevronRight, Compass, Globe, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { FormMessage } from '@/components/FormMessage';
import { PressableScale } from '@/components/PressableScale';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import { shortDay } from '@/lib/packVisuals';
import type { LocalUnitNotes } from '@/types/api';
import { colors, layout, radii, spacing, tints } from '@/theme/theme';

/**
 * A unit's "In Chengdu" section (issue #40): notes from what the research agent found, each term with
 * audio, the sources, and the local practice lesson. It sits on top of the course and doesn't change
 * how the unit is finished.
 */
export function LocalNotes({
  notes,
  city,
  lessonDone,
  onOpenLesson,
  onOpenSources,
}: {
  notes: LocalUnitNotes;
  city: string;
  lessonDone: boolean;
  onOpenLesson: (lessonId: string) => void;
  onOpenSources: () => void;
}) {
  const [audioError, setAudioError] = useState<string | null>(null);
  const checkedOn = notes.checked_at ? shortDay(notes.checked_at) : null;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text variant="heading" accessibilityRole="header" style={styles.flex}>
          In {city}
        </Text>
        <MapPin size={20} color={tints.sun.fg} />
      </View>
      {notes.sources.length > 0 ? (
        <PressableScale
          onPress={onOpenSources}
          accessibilityRole="button"
          accessibilityLabel={`From the web${checkedOn ? `, checked ${checkedOn}` : ''}. Show the ${notes.sources.length} sources.`}
          style={styles.sourcesLine}>
          <Globe size={14} color={colors.sky700} />
          <Text variant="caption" color={colors.inkMuted}>
            From the web{checkedOn ? `, checked ${checkedOn}` : ''} ·{' '}
            <Text variant="caption" color={colors.sky700}>
              Sources
            </Text>
          </Text>
        </PressableScale>
      ) : null}
      {audioError ? <FormMessage message={audioError} /> : null}

      {notes.notes.map((note) => (
        <Card key={note.title} style={styles.note}>
          <Text variant="bodyStrong">{note.title}</Text>
          <Text variant="body" color={colors.inkMuted}>
            {note.body}
          </Text>
          {note.terms.map((term) => (
            <View key={term.hanzi} style={styles.term}>
              <View style={styles.flex}>
                <Text variant="hanziSmall">{term.hanzi}</Text>
                <Text variant="caption" color={colors.inkMuted}>
                  {term.pinyin} · {term.english}
                </Text>
              </View>
              <SpeakerButton text={term.hanzi} label={`Play ${term.english}`} size={40} onError={setAudioError} />
            </View>
          ))}
        </Card>
      ))}

      {notes.lesson ? (
        <Card
          onPress={() => notes.lesson && onOpenLesson(notes.lesson.id)}
          accessibilityLabel={`${notes.lesson.title}. ${notes.lesson.exercises.length} questions.${lessonDone ? ' Done.' : ''}`}
          accessibilityHint="Opens the local practice lesson"
          style={styles.lessonRow}>
          <View style={[styles.lessonTile, lessonDone ? styles.lessonTileDone : null]}>
            {lessonDone ? <Check size={18} color={colors.surface} strokeWidth={3} /> : <Compass size={20} color={tints.sun.fg} />}
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{notes.lesson.title}</Text>
            <Text variant="caption" color={colors.inkMuted}>
              {notes.lesson.exercises.length} questions · doesn&apos;t count toward the unit
            </Text>
          </View>
          <ChevronRight size={20} color={colors.inkMuted} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourcesLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: layout.minTouchTarget },
  note: { gap: spacing.sm },
  term: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lessonTile: {
    width: 44,
    height: 44,
    borderRadius: radii.input,
    backgroundColor: tints.sun.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonTileDone: { backgroundColor: colors.success },
});
