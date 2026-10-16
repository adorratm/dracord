import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { ChatView } from './ChatView';
import { Icon } from './Icon';
import { UserAvatar } from './UserAvatar';
import { leaveActivityFully } from '../lib/leaveActivityFully';
import { useVoiceSession } from './voice/VoiceSession';
import { useActivitySessionOptional } from './activity/ActivitySession';
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
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const activity = useActivitySessionOptional();
  const shell = useAppShellOptional();
  const [showChat, setShowChat] = useState(false);
  const [liveChannel, setLiveChannel] = useState(channel);
  /** Bu odadan bilinçli ayrılınca otomatik tekrar join etme */
  const declinedAutoJoinRef = useRef(false);
  const wasInThisChannelRef = useRef(false);

  useEffect(() => {
    setLiveChannel(channel);
    declinedAutoJoinRef.current = false;
    wasInThisChannelRef.current = false;
  }, [channel.id]);

  const inThisChannel = voice.voiceChannelId === channel.id;
  const browsingOther =
    Boolean(voice.voiceChannelId) && voice.voiceChannelId !== channel.id;

  useEffect(() => {
    if (inThisChannel) {
      wasInThisChannelRef.current = true;
      declinedAutoJoinRef.current = false;
      return;
    }
    // Bu odadayken ayrıldı → tekrar auto-join yapma
    if (wasInThisChannelRef.current && !voice.voiceChannelId) {
      declinedAutoJoinRef.current = true;
    }
  }, [inThisChannel, voice.voiceChannelId]);

  useEffect(() => {
    if (!guildId) return;
    // Başka sesteyken bu odayı sadece göz gezdir — otomatik katılma
    if (browsingOther) return;
    if (declinedAutoJoinRef.current) return;
    if (inThisChannel) return;
    void (async () => {
      // Oyun sesi / aktivite hâlâ açıksa önce tamamen ayrıl
      if (activity?.activityChannelId) {
        await leaveActivityFully({
          client,
          sessionId: activity.activitySessionId,
          channelId: activity.activityChannelId,
          clearActiveActivity: activity.clearActiveActivity,
          voice,
        });
      }
      if (declinedAutoJoinRef.current) return;
      await voice.join(guildId, {
        id: channel.id,
        name: channel.name,
        type: channel.type,
      });
    })();
  }, [guildId, channel.id, channel.name, channel.type, browsingOther, inThisChannel]); // eslint-disable-line react-hooks/exhaustive-deps -- join stable

  // Sunucu kanal listesinden voiceMembers (avatar + joinedAt)
  useEffect(() => {
    const fromShell = shell?.channels.find((c) => c.id === channel.id);
    if (fromShell) setLiveChannel(fromShell);
  }, [shell?.channels, channel.id]);

  const members = useMemo((): VoiceMemberSummary[] => {
    let remote = liveChannel.voiceMembers ?? [];
    if (user?.id && !inThisChannel) {
      remote = remote.filter((m) => m.id !== user.id);
    }
    if (!inThisChannel) return remote;
    // API gecikse bile LiveKit peer’larını birleştir (sol liste / oda)
    const byId = new Map(remote.map((m) => [m.id, m]));
    for (const p of voice.peers) {
      const peerId =
        p.id === 'self' || (user && p.id === user.id) ? user!.id : p.id;
      if (user && peerId === user.id) {
        const existing = byId.get(user.id);
        byId.set(user.id, {
          id: user.id,
          displayName: existing?.displayName ?? user.displayName,
          avatarUrl: existing?.avatarUrl ?? user.avatarUrl,
          muted: existing?.muted ?? voice.muted,
          deafened: existing?.deafened ?? voice.deafened,
          speaking: p.speaking,
        });
        continue;
      }
      const existing = byId.get(peerId);
      if (existing) {
        byId.set(peerId, { ...existing, speaking: p.speaking, displayName: p.name });
      } else {
        byId.set(peerId, {
          id: peerId,
          displayName: p.name,
          avatarUrl: null,
          speaking: p.speaking,
          muted: false,
          deafened: false,
        });
      }
    }
    if (user && !byId.has(user.id)) {
      byId.set(user.id, {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        muted: voice.muted,
        deafened: voice.deafened,
        speaking: false,
      });
    }
    return [...byId.values()];
  }, [
    liveChannel.voiceMembers,
    voice.peers,
    voice.muted,
    voice.deafened,
    inThisChannel,
    user,
  ]);

  const rejoin = async () => {
    if (!guildId) return;
    declinedAutoJoinRef.current = false;
    await voice.join(guildId, {
      id: channel.id,
      name: channel.name,
      type: channel.type,
    });
  };

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
            {inThisChannel
              ? voice.status || (voice.connected ? 'Bağlı' : '…')
              : browsingOther
                ? 'Göz atılıyor'
                : 'Bağlı değilsin'}
            {inThisChannel && voice.screenSharing ? ' · Ekran paylaşılıyor' : ''}
            {inThisChannel && voice.camOn ? ' · Kamera açık' : ''}
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

      {!inThisChannel && !browsingOther ? (
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
            Bu ses kanalında değilsin.
          </Text>
          {guildId ? (
            <Pressable style={primaryBtn} onPress={() => void rejoin()}>
              <Text style={primaryBtnText}>Katıl</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
              onPress={() =>
                void voice.join(guildId, {
                  id: channel.id,
                  name: channel.name,
                  type: channel.type,
                })
              }
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
