import { Tabs } from 'expo-router/js-tabs';
import { BookOpen, ListChecks, MessagesSquare, NotebookText, UserRound } from 'lucide-react-native';

import { colors, fonts } from '@/theme/theme';

// Open on Encounters, the middle tab, even though Lessons comes first in the tab bar (e.g. right after sign-in).
export const unstable_settings = {
  anchor: 'index',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.sky600,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        // 11, not 12, so "Encounters" fits a fifth of a 360pt-wide phone without being cut off.
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="lessons"
        options={{
          title: 'Lessons',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Encounters',
          tabBarIcon: ({ color, size }) => <MessagesSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="essentials"
        options={{
          title: 'Essentials',
          tabBarIcon: ({ color, size }) => <NotebookText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
