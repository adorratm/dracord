import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { GuildSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';

export default function DiscoverScreen() {
  const { client } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<GuildSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client
      .discoverGuilds()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Keşfet yüklenemedi'));
  }, [client]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Keşfet' }} />
      {error ? <Text style={{ color: colors.danger, padding: 16 }}>{error}</Text> : null}
      <FlatList
        data={list}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item: g }) => (
          <Pressable
            onPress={() => {
              void client.joinDiscoverableGuild(g.id).then(() => router.replace('/(app)/guilds'));
            }}
            style={{
              marginBottom: 12,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: colors.surface,
            }}
          >
            {g.bannerUrl ? (
              <Image source={{ uri: g.bannerUrl }} style={{ height: 88, width: '100%' }} />
            ) : (
              <View style={{ height: 88, backgroundColor: colors.surfaceHigh }} />
            )}
            <Text style={{ color: colors.text, fontWeight: '700', padding: 12 }}>{g.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
