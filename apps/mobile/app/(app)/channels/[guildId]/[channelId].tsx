import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ChannelSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../../lib/auth';
import { ChatView } from '../../../../components/ChatView';
import { Icon } from '../../../../components/Icon';
import { ShellHeader, useAppShell } from '../../../../components/shell/AppShell';

export default function ChannelScreen() {
  const { guildId = '', channelId = '', around } = useLocalSearchParams<{
    guildId: string;
    channelId: string;
    around?: string;
  }>();
  const { client } = useAuth();
  const router = useRouter();
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
        <ShellHeader title="Kanal" showChannels showMembers />
        <Text style={{ color: colors.textMuted, padding: 16 }}>Kanal yükleniyor…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title={channel.name} showChannels showMembers />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceHigh,
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          accessibilityLabel="Geri"
        >
          <Icon name="arrow_back" size={18} color={colors.primary} />
        </Pressable>
        {channel.topic ? (
          <Text style={{ color: colors.textMuted, flex: 1, fontSize: 12 }} numberOfLines={1}>
            {channel.topic}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
      <ChatView
        channel={channel}
        hideChannelChrome
        guildId={guildId}
        aroundMessageId={typeof around === 'string' ? around : around?.[0] ?? null}
      />
    </View>
  );
}
