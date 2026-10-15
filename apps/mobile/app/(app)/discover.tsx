import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { GuildSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { guildBannerUrl, resolveMediaUrl } from '../../lib/mediaUrl';
import { ShellHeader } from '../../components/shell/AppShell';

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Keşfet" />
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
            <View style={{ height: 88, backgroundColor: colors.surfaceHigh }}>
              <Image
                source={{ uri: guildBannerUrl(g.bannerUrl) }}
                style={{ height: 88, width: '100%' }}
                resizeMode="cover"
              />
              {g.iconUrl ? (
                <Image
                  source={{ uri: resolveMediaUrl(g.iconUrl) ?? undefined }}
                  style={{
                    position: 'absolute',
                    left: 12,
                    bottom: 10,
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                  }}
                />
              ) : null}
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', padding: 12 }}>{g.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
