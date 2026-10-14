import { Redirect, Stack, useSegments } from 'expo-router';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';

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
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
