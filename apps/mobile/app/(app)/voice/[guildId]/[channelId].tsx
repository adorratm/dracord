import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ChannelSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../../lib/auth';
import { VoiceRoom } from '../../../../components/VoiceRoom';
import { ShellHeader, useAppShell } from '../../../../components/shell/AppShell';

export default function VoiceScreen() {
  const { guildId = '', channelId = '' } = useLocalSearchParams<{
    guildId: string;
    channelId: string;
  }>();
  const { client } = useAuth();
  const { setActiveChannelId } = useAppShell();
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
        <ShellHeader title="Ses" showChannels showMembers />
        <Text style={{ color: colors.textMuted, padding: 16 }}>Ses odası yükleniyor…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title={channel.name} showChannels showMembers />
      <VoiceRoom channel={channel} guildId={guildId} />
    </View>
  );
}
