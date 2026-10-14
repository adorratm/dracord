import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.usernameConfirmed === false) {
    return <Redirect href="/(app)/onboarding/username" />;
  }
  return <Redirect href="/(app)/guilds" />;
}
