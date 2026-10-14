// Per-weight imports so only the five weights we use end up in the bundle.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProfileErrorOverlay } from '@/components/ProfileErrorOverlay';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import { colors } from '@/theme/theme';

// Keep the splash screen up until fonts and the first session/profile check are done.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          {/* If fonts fail to load, carry on with the system font rather than hang on the splash. */}
          <RootNavigator fontsReady={fontsLoaded || fontError != null} />
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, profile, loading, profileError } = useAuth();
  const ready = fontsReady && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  const signedIn = session !== null;
  const onboarded = profile?.onboarding_complete === true;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="setup" options={{ animation: 'fade' }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="encounter/[id]/index" />
          <Stack.Screen name="encounter/[id]/talk" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>

      {signedIn && !profile && profileError ? <ProfileErrorOverlay /> : null}
    </>
  );
}
