import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ChannelSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../../lib/auth';
import { ChatView } from '../../../../components/ChatView';

export default function ChannelScreen() {
  const { guildId = '', channelId = '' } = useLocalSearchParams<{
    guildId: string;
    channelId: string;
  }>();
  const { client } = useAuth();
  const [channel, setChannel] = useState<ChannelSummary | null>(null);

  useEffect(() => {
    void client.getGuildChannels(guildId).then((list) => {
      setChannel(list.find((c) => c.id === channelId) ?? null);
    });
  }, [client, guildId, channelId]);

  if (!channel) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textMuted }}>Kanal yükleniyor…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `#${channel.name}` }} />
      <ChatView channel={channel} />
    </>
  );
}
