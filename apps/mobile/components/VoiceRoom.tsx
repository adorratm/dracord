import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { VOICE_CHANNEL_STATUS_MAX, type ChannelSummary, type GameSessionDto, type VoiceMemberSummary } from '@dracord/types';
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
import { useSoundboard } from '../lib/useSoundboard';
import { GamesStrip, MobileGameFrame, useMobileGameSessions } from './GameRoom';
import { ScreenShareViewer } from './voice/ScreenShareViewer';
import { CaptionsStrip } from './voice/CaptionsStrip';

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
  const [statusEditing, setStatusEditing] = useState(false);
  const soundboard = useSoundboard(client, guildId, voice.voiceChannelId === channel.id ? channel.id : null, {
    deafened: voice.deafened,
  });
  const [sbMsg, setSbMsg] = useState<string | null>(null);
  const gameSessions = useMobileGameSessions(
    client,
    voice.voiceChannelId === channel.id ? guildId : null,
    voice.voiceChannelId === channel.id ? channel.id : null,
  );
  const [openGame, setOpenGame] = useState<GameSessionDto | null>(null);
  const liveOpenGame = openGame ? gameSessions.find((g) => g.id === openGame.id) ?? openGame : null;
  const [statusDraft, setStatusDraft] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
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

  const saveStatus = async (value: string | null) => {
    if (!shell?.setVoiceStatus) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      const res = await shell.setVoiceStatus(channel.id, value && value.trim() ? value : null);
      if (!res.ok) {
        setStatusError(
          res.error === 'not_in_channel'
            ? 'Durumu yalnızca kanaldakiler değiştirebilir.'
            : res.error === 'rate_limited'
              ? 'Biraz yavaş — birkaç saniye sonra tekrar dene.'
              : 'Durum kaydedilemedi.',
        );
        return;
      }
      setStatusEditing(false);
    } finally {
      setStatusBusy(false);
    }
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

      {/* Ses kanalı durum metni */}
      {liveChannel.voiceStatus || (inThisChannel && shell?.setVoiceStatus) ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceHigh,
            gap: 6,
          }}
        >
          {statusEditing ? (
            <>
              <TextInput
                value={statusDraft}
                onChangeText={setStatusDraft}
                maxLength={VOICE_CHANNEL_STATUS_MAX}
                autoFocus
                editable={!statusBusy}
                placeholder="Ne yapıyorsunuz? (ör. Valorant ranked)"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={() => void saveStatus(statusDraft)}
                style={{
                  color: colors.text,
                  backgroundColor: colors.surfaceHigh,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 14,
                }}
                accessibilityLabel="Ses kanalı durumu"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={primaryBtn} disabled={statusBusy} onPress={() => void saveStatus(statusDraft)}>
                  <Text style={primaryBtnText}>Kaydet</Text>
                </Pressable>
                {liveChannel.voiceStatus ? (
                  <Pressable disabled={statusBusy} onPress={() => void saveStatus(null)} style={{ padding: 10 }}>
                    <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Temizle</Text>
                  </Pressable>
                ) : null}
                <Pressable disabled={statusBusy} onPress={() => setStatusEditing(false)} style={{ padding: 10 }}>
                  <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Vazgeç</Text>
                </Pressable>
              </View>
              {statusError ? (
                <Text style={{ color: colors.danger, fontSize: 12 }}>{statusError}</Text>
              ) : null}
            </>
          ) : (
            <Pressable
              disabled={!inThisChannel || !shell?.setVoiceStatus}
              onPress={() => {
                setStatusDraft(liveChannel.voiceStatus ?? '');
                setStatusError(null);
                setStatusEditing(true);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              accessibilityLabel="Ses kanalı durumunu düzenle"
            >
              <Icon
                name={liveChannel.voiceStatus ? 'notes' : 'edit'}
                size={16}
                color={colors.textMuted}
              />
              <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }} numberOfLines={2}>
                {liveChannel.voiceStatus || 'Durum ekle'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {inThisChannel && guildId ? <CaptionsStrip client={client} guildId={guildId} channelId={channel.id} /> : null}
      {inThisChannel && guildId && user
        ? voice.peers
            .filter((p) => p.screenShare && p.id !== user.id)
            .slice(0, 1)
            .map((p) => (
              <ScreenShareViewer
                key={p.id}
                client={client}
                userId={user.id}
                guildId={guildId}
                channelId={channel.id}
                sharerId={p.id}
                sharerName={p.name}
              />
            ))
        : null}
      {inThisChannel && guildId ? (
        <GamesStrip client={client} guildId={guildId} channelId={channel.id} sessions={gameSessions} onOpen={setOpenGame} />
      ) : null}
      {liveOpenGame ? (
        <MobileGameFrame
          client={client}
          session={liveOpenGame}
          resolveParticipant={(id) => {
            const m = members.find((x) => x.id === id);
            return { id, displayName: m?.displayName ?? 'Oyuncu', avatarUrl: m?.avatarUrl ?? null };
          }}
          onClose={(o) => {
            const id = liveOpenGame.id;
            setOpenGame(null);
            if (o?.leave !== false) void client.leaveGameSession(id).catch(() => undefined);
          }}
          onSetStatus={(t) => void shell?.setVoiceStatus?.(channel.id, t)}
        />
      ) : null}

      {inThisChannel && soundboard.sounds.length > 0 ? (
        <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
            {soundboard.sounds.map((snd) => (
              <Pressable
                key={snd.id}
                disabled={voice.deafened}
                onPress={() =>
                  void soundboard.play(snd.id).then((r) =>
                    setSbMsg(r.ok ? null : r.error === 'rate_limited' ? 'Biraz bekle…' : 'Çalınamadı'),
                  )
                }
                accessibilityLabel={`${snd.name} sesini çal`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceHigh,
                  opacity: voice.deafened ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 16 }}>{snd.emoji || '🔊'}</Text>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                  {snd.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {sbMsg ? <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 14, marginTop: 4 }}>{sbMsg}</Text> : null}
        </View>
      ) : null}

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
