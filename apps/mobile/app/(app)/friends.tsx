import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { colors } from '@dracord/app-theme';
import { FriendsHub } from '../../components/FriendsHub';
import { ShellHeader } from '../../components/shell/AppShell';
import { useAuth } from '../../lib/auth';

export default function FriendsScreen() {
  const router = useRouter();
  const { client } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Arkadaşlar" />
      <FriendsHub
        onOpenDm={(userId) => {
          void client.openDm(userId).then(() => router.push('/(app)/dms'));
        }}
      />
    </View>
  );
}
