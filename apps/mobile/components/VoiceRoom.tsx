import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { ChatView } from './ChatView';
import { Icon } from './Icon';
import { UserAvatar } from './UserAvatar';
import { useVoiceSession } from './voice/VoiceSession';
import { useAppShellOptional } from './shell/AppShell';
import { useElapsedLabel } from '../lib/formatElapsed';
import { primaryBtn, primaryBtnText } from '../lib/ui';

/** Ses odası — kontroller alt VoiceConnectionBar’da */
export function VoiceRoom({
  channel,
  guildId,
}: {
  channel: ChannelSummary;
  guildId?: string;
}) {
  const { user } = useAuth();
  const voice = useVoiceSession();
  const shell = useAppShellOptional();
  const [showChat, setShowChat] = useState(false);
  const [liveChannel, setLiveChannel] = useState(channel);

  useEffect(() => {
    setLiveChannel(channel);
  }, [channel]);

  const browsingOther =
    Boolean(voice.voiceChannelId) && voice.voiceChannelId !== channel.id;

  useEffect(() => {
    if (!guildId) return;
    // Başka sesteyken bu odayı sadece göz gezdir — otomatik katılma
    if (browsingOther) return;
    void voice.join(guildId, { id: channel.id, name: channel.name });
  }, [guildId, channel.id, channel.name, browsingOther]); // eslint-disable-line react-hooks/exhaustive-deps -- join stable

  // Sunucu kanal listesinden voiceMembers (avatar + joinedAt)
  useEffect(() => {
    const fromShell = shell?.channels.find((c) => c.id === channel.id);
    if (fromShell) setLiveChannel(fromShell);
  }, [shell?.channels, channel.id]);

  const members = useMemo((): VoiceMemberSummary[] => {
    let remote = liveChannel.voiceMembers ?? [];
    if (browsingOther && user?.id) {
      remote = remote.filter((m) => m.id !== user.id);
    }
    if (remote.length) return remote;
    if (browsingOther) return [];
    return voice.peers.map((p) => ({
      id: p.id,
      displayName: p.name,
      avatarUrl: null,
      speaking: p.speaking,
    }));
  }, [liveChannel.voiceMembers, voice.peers, browsingOther, user?.id]);

  if (showChat && guildId) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={() => setShowChat(false)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceHigh,
          }}
        >
          <Icon name="arrow_back" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Ses odası</Text>
        </Pressable>
        <ChatView channel={channel} hideChannelChrome />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceHigh,
        }}
      >
        <Icon name="volume_up" size={22} color={colors.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
            {channel.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {voice.status || (voice.connected ? 'Bağlı' : '…')}
            {voice.screenSharing ? ' · Ekran paylaşılıyor' : ''}
            {voice.camOn ? ' · Kamera açık' : ''}
          </Text>
        </View>
        {guildId ? (
          <Pressable
            onPress={() => setShowChat(true)}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surfaceHigh,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Sohbet"
          >
            <Icon name="chat" size={18} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {browsingOther ? (
        <View
          style={{
            margin: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceHigh,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
            Şu an “{voice.voiceChannelName ?? 'başka bir kanal'}” odasındasın. Bu odayı
            sadece göz gezdiriyorsun — katılınca mevcut sesten ayrılırsın.
          </Text>
          {guildId ? (
            <Pressable
              style={primaryBtn}
              onPress={() => void voice.join(guildId, { id: channel.id, name: channel.name })}
            >
              <Text style={primaryBtnText}>Bu kanala katıl</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {voice.voiceOnOtherClient ? (
        <View
          style={{
            margin: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceHigh,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
            Ses başka bir istemcide açık. Alttan “Bu cihaza al” ile geçebilirsin.
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 8, gap: 6 }}
      >
        {members.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 24 }}>
            Odada henüz kimse yok…
          </Text>
        ) : (
          members.map((m) => {
            const speaking =
              m.speaking || voice.peers.find((p) => p.id === m.id || p.name === m.displayName)?.speaking;
            return (
              <VoicePeerCard
                key={m.id}
                displayName={m.displayName}
                avatarUrl={m.avatarUrl}
                speaking={speaking}
                muted={m.muted}
                deafened={m.deafened}
                screenSharing={m.screenSharing}
                isBot={m.isBot}
                joinedAt={m.joinedAt}
                onPress={() => shell?.openVoiceMember(m, liveChannel)}
                onLongPress={() => shell?.openVoiceMemberMenu(m, liveChannel)}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function VoicePeerCard({
  displayName,
  avatarUrl,
  speaking,
  muted,
  deafened,
  screenSharing,
  isBot,
  joinedAt,
  onPress,
  onLongPress,
}: {
  displayName: string;
  avatarUrl?: string | null;
  speaking?: boolean;
  muted?: boolean;
  deafened?: boolean;
  screenSharing?: boolean;
  isBot?: boolean;
  joinedAt?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const elapsed = useElapsedLabel(joinedAt);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: speaking ? colors.surfaceHigh : colors.surface,
        borderRadius: 10,
        borderWidth: speaking ? 1.5 : 1,
        borderColor: speaking ? colors.primary : colors.surfaceHigh,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <UserAvatar
        displayName={displayName}
        imageUrl={avatarUrl}
        size={40}
        speaking={speaking}
        statusRing={false}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          {elapsed ? `Seste ${elapsed}` : speaking ? 'Konuşuyor' : 'Dinliyor'}
        </Text>
      </View>
      {isBot ? (
        <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>BOT</Text>
      ) : null}
      {screenSharing ? <Icon name="present_to_all" size={16} color={colors.primary} /> : null}
      {speaking ? <Icon name="graphic_eq" size={18} color={colors.primary} /> : null}
      {muted ? <Icon name="mic_off" size={16} color={colors.danger} /> : null}
      {deafened ? <Icon name="headset_off" size={16} color={colors.danger} /> : null}
    </Pressable>
  );
}
