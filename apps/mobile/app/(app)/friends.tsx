import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { FriendsHub } from '../../components/FriendsHub';

export default function FriendsScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Arkadaşlar' }} />
      <FriendsHub
        onOpenDm={() => {
          router.push('/(app)/dms');
        }}
      />
    </View>
  );
}
