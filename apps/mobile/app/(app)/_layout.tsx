import { Redirect, Stack, useSegments } from 'expo-router';
import { View } from 'react-native';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { AppTour } from '../../components/AppTour';
import { AppShellProvider } from '../../components/shell/AppShell';
import { VoiceSessionProvider } from '../../components/voice/VoiceSession';
import { AppUpdateGate } from '../../components/AppUpdateGate';
import { VoiceConnectionBar } from '../../components/voice/VoiceConnectionBar';
import { MusicPlayerBar } from '../../components/voice/MusicPlayerBar';
import { ActivitySessionProvider } from '../../components/activity/ActivitySession';
import { ActivityConnectionBar } from '../../components/activity/ActivityConnectionBar';
import { ConfirmModalHost } from '../../components/ConfirmModal';

export default function AppLayout() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const onOnboarding = segments.some((s) => s === 'onboarding');

  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!onOnboarding && user.usernameConfirmed === false) {
    return <Redirect href="/(app)/onboarding/username" />;
  }

  return (
    <VoiceSessionProvider>
      <ActivitySessionProvider>
        <AppShellProvider>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              />
            </View>
            <ActivityConnectionBar />
            <MusicPlayerBar />
            <VoiceConnectionBar />
            {!onOnboarding ? <AppTour /> : null}
            <AppUpdateGate />
            <ConfirmModalHost />
          </View>
        </AppShellProvider>
      </ActivitySessionProvider>
    </VoiceSessionProvider>
  );
}
