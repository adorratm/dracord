import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ChannelSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../../lib/auth';
import { ActivityRoom } from '../../../../components/ActivityRoom';
import { GameWebEmbed } from '../../../../components/GameWebEmbed';
import { ShellHeader, useAppShell } from '../../../../components/shell/AppShell';

export default function ActivityScreen() {
  const { guildId = '', channelId = '' } = useLocalSearchParams<{
    guildId: string;
    channelId: string;
  }>();
  const { client } = useAuth();
  const { setActiveChannelId } = useAppShell();
  const router = useRouter();
  const [channel, setChannel] = useState<ChannelSummary | null>(null);

  useEffect(() => {
    setActiveChannelId(channelId);
    void client.getGuildChannels(guildId).then((list) => {
      setChannel(list.find((c) => c.id === channelId) ?? null);
    });
  }, [client, guildId, channelId, setActiveChannelId]);

  if (!channel) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ShellHeader title="Aktivite" showChannels showMembers />
        <Text style={{ color: colors.textMuted, padding: 16 }}>Aktivite yükleniyor…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title={channel.name} showChannels showMembers />
      {channel.gameKind === 'app' ? (
        // developer-portal game: the web embed joins the channel and opens the game frame
        <GameWebEmbed guildId={guildId} channelId={channel.id} onActivityLeave={() => router.back()} />
      ) : (
        <ActivityRoom guildId={guildId} channel={channel} />
      )}
    </View>
  );
}
