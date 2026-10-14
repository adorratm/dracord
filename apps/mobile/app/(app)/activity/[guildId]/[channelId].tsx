import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ChannelSummary } from '@dracord/types';
import { GAME_KIND_LABEL } from '@dracord/game-core';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../../lib/auth';
import { ActivityRoom } from '../../../../components/ActivityRoom';

export default function ActivityScreen() {
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
        <Text style={{ color: colors.textMuted }}>Aktivite yükleniyor…</Text>
      </View>
    );
  }

  const title = channel.gameKind
    ? GAME_KIND_LABEL[channel.gameKind]
    : channel.type === 'WATCH_PARTY'
      ? GAME_KIND_LABEL.watch_party
      : channel.name;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ActivityRoom guildId={guildId} channel={channel} />
    </>
  );
}
