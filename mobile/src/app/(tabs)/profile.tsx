import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  Award,
  ChevronRight,
  Ear,
  Eye,
  Languages,
  LogOut,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Sailboat,
  Volume2,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useCities } from '@/hooks/useCities';
import { useEncounterProgress } from '@/hooks/useEncounterProgress';
import { usePack } from '@/hooks/usePack';
import { useScenarios } from '@/hooks/useScenarios';
import { useAuth } from '@/lib/auth';
import { type Settings, useSettings } from '@/lib/settings';
import { colors, fonts, motion, radii, spacing, tints } from '@/theme/theme';

function initialsOf(name: string | null | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split('@')[0] || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

const SETTING_ROWS: { key: keyof Settings; label: string; description: string; icon: LucideIcon }[] = [
  { key: 'showPinyin', label: 'Show pinyin', description: 'Under every Chinese line', icon: Languages },
  { key: 'autoEnglish', label: 'Show English automatically', description: 'Otherwise tap to reveal', icon: Eye },
  { key: 'autoPlay', label: 'Auto-play voice', description: 'Hear each reply as it arrives', icon: Volume2 },
  { key: 'tapToHear', label: 'Hear words as you tap', description: 'Answers, tiles and pairs in lessons and quizzes', icon: Ear },
  { key: 'challengeMode', label: 'Challenge mode', description: 'Lessons and quizzes: misses can sink the boat', icon: Sailboat },
];

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const { settings, updateSetting } = useSettings();
  const { completedCount, completedScenarioIds, loading: progressLoading } = useEncounterProgress();
  const { scenarios } = useScenarios();
  const { cities } = useCities();
  const { pack } = usePack();
  const [signingOut, setSigningOut] = useState(false);

  const email = session?.user.email;
  const displayName = profile?.display_name?.trim() || 'Traveler';
  // Built-in scenes plus the current city's local ones; finished ones elsewhere (another city) don't count here.
  const sceneIds = new Set([...(scenarios ?? []), ...(pack?.encounters ?? [])].map((scenario) => scenario.id));
  const totalScenes = scenarios ? sceneIds.size : 3 + (pack?.encounters.length ?? 0);
  const scenesFinished = scenarios ? [...completedScenarioIds].filter((id) => sceneIds.has(id)).length : completedScenarioIds.size;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const destination = cities?.find((city) => city.slug === profile?.destination_city) ?? null;
  const destinationSet = Boolean(profile?.destination_city);
  const destinationLabel = destination?.name ?? profile?.destination_city ?? 'Set your destination';

  const confirmSignOut = () => {
    Alert.alert('Log out?', 'You can log back in any time with your email and password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          signOut().finally(() => setSigningOut(false));
        },
      },
    ]);
  };

  return (
    <Screen scroll edges={['top']}>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.identity}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.initials} color="#FFFFFF">
            {initialsOf(profile?.display_name, email)}
          </Text>
        </View>
        <Text variant="title" align="center" accessibilityRole="header">
          {displayName}
        </Text>
        {email ? (
          <Text variant="body" color={colors.inkMuted} align="center">
            {email}
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(motion.base).delay(60)} style={styles.section}>
        <Card style={styles.languageRow}>
          <View style={styles.rowIcon}>
            <Languages size={20} color={colors.sky700} />
          </View>
          <View style={styles.flex}>
            <Text variant="caption" color={colors.inkMuted}>
              Learning
            </Text>
            <Text variant="subheading">Mandarin Chinese</Text>
          </View>
          <Text variant="hanzi" color={colors.sky700}>
            中文
          </Text>
        </Card>
        {/* The one place to choose or change the city (onboarding asks once too). */}
        <Card
          onPress={() => router.push('/destination')}
          accessibilityLabel={
            destinationSet
              ? `Going to: ${destinationLabel}. Change your destination.`
              : 'Where are you going? Set your destination to get lessons and scenes for your city.'
          }
          style={[styles.languageRow, destinationSet ? null : styles.destinationPrompt]}>
          <View style={[styles.rowIcon, destinationSet ? null : { backgroundColor: tints.sun.bg }]}>
            <MapPin size={20} color={destinationSet ? colors.sky700 : tints.sun.fg} />
          </View>
          <View style={styles.flex}>
            <Text variant="caption" color={colors.inkMuted}>
              {destinationSet ? 'Going to' : 'Where are you going?'}
            </Text>
            <Text variant="subheading">{destinationLabel}</Text>
            {destinationSet ? null : (
              <Text variant="caption" color={colors.inkMuted}>
                Get lessons and scenes for your city.
              </Text>
            )}
          </View>
          {destination ? (
            <Text variant="hanzi" color={colors.sky700}>
              {destination.hanzi}
            </Text>
          ) : null}
          <ChevronRight size={20} color={colors.inkMuted} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(motion.base).delay(120)} style={styles.section}>
        <Text variant="heading">Your progress</Text>
        <View style={styles.stats}>
          <Card style={styles.stat}>
            <Award size={22} color="#A16207" />
            {progressLoading ? (
              <ActivityIndicator color={colors.sky600} style={styles.statLoader} />
            ) : (
              <Text style={styles.statNumber}>{completedCount}</Text>
            )}
            <Text variant="caption" color={colors.inkMuted}>
              Encounters completed
            </Text>
          </Card>
          <Card style={styles.stat}>
            <MapIcon size={22} color={colors.sky700} />
            {progressLoading ? (
              <ActivityIndicator color={colors.sky600} style={styles.statLoader} />
            ) : (
              <Text style={styles.statNumber}>
                {scenesFinished}
                <Text variant="bodyMedium" color={colors.inkMuted}>
                  {' '}
                  / {totalScenes}
                </Text>
              </Text>
            )}
            <Text variant="caption" color={colors.inkMuted}>
              Scenes finished
            </Text>
          </Card>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(motion.base).delay(180)} style={styles.section}>
        <Text variant="heading">Settings</Text>
        <Card padded={false}>
          {SETTING_ROWS.map((row, index) => {
            const Icon = row.icon;
            return (
              <View key={row.key} style={[styles.settingRow, index > 0 ? styles.rowDivider : null]}>
                <Icon size={20} color={colors.inkMuted} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{row.label}</Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {row.description}
                  </Text>
                </View>
                <Switch
                  value={settings[row.key]}
                  onValueChange={(value) => updateSetting(row.key, value)}
                  trackColor={{ true: colors.sky500, false: colors.line }}
                  ios_backgroundColor={colors.line}
                  accessibilityLabel={row.label}
                />
              </View>
            );
          })}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(motion.base).delay(240)} style={styles.section}>
        <Button label="Log out" icon={LogOut} variant="danger" onPress={confirmSignOut} loading={signingOut} />
        <Text variant="caption" color={colors.inkMuted} align="center" style={styles.version}>
          Lingvoyage v{version}
        </Text>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xxl, marginBottom: spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    backgroundColor: colors.sky600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: colors.sky100,
  },
  initials: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36 },
  section: { gap: spacing.md, marginTop: spacing.xl },
  languageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  destinationPrompt: { borderWidth: 2, borderColor: colors.sun300, backgroundColor: tints.sun.bg },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.input,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: spacing.xs },
  statNumber: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 38, color: colors.ink },
  statLoader: { alignSelf: 'flex-start', height: 38 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  version: { marginTop: spacing.sm },
});
