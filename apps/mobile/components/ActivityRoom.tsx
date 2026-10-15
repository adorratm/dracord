import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SocketEvents, type ActivitySessionDto, type ChannelSummary } from '@dracord/types';
import { watchPartyParseState } from '@dracord/game-core';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { resolveWatchMedia } from '../lib/watchPartyMedia';
import { ChatView } from './ChatView';
import { Icon } from './Icon';
import { useActivitySessionOptional } from './activity/ActivitySession';
import { SafeWebView, type SafeWebViewHandle } from './SafeWebView';
import { GameWebEmbed } from './GameWebEmbed';
import { primaryBtn, primaryBtnText } from '../lib/ui';

const NOOP_ACTIVITY = {
  activityChannelId: null as string | null,
  activityChannelName: null as string | null,
  activitySessionId: null as string | null,
  setActiveActivity: (_opts: {
    guildId: string;
    channelId: string;
    channelName: string;
    kind: ActivitySessionDto['kind'];
    sessionId: string;
    participantIds?: string[];
  }) => undefined,
  setActivityParticipants: (_ids: string[]) => undefined,
  clearActiveActivity: () => undefined,
};

export function ActivityRoom({
  guildId,
  channel,
}: {
  guildId: string;
  channel: ChannelSummary;
}) {
  const { client, user } = useAuth();
  const router = useRouter();
  const activityCtx = useActivitySessionOptional() ?? NOOP_ACTIVITY;
  const {
    activityChannelId,
    activityChannelName,
    activitySessionId,
    setActiveActivity,
    setActivityParticipants,
    clearActiveActivity,
  } = activityCtx;
  const [session, setSession] = useState<ActivitySessionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [joining, setJoining] = useState(false);
  const [gameLandscapeFs, setGameLandscapeFs] = useState(false);
  /** Ayrıldıktan sonra enterRoom auto-join etmesin */
  const leftRef = useRef(false);

  const browsingOther =
    Boolean(activityChannelId) && activityChannelId !== channel.id;

  const remember = useCallback(
    (s: ActivitySessionDto) => {
      const participantIds = [...(s.playerIds ?? []), ...(s.spectatorIds ?? [])];
      setActiveActivity({
        guildId,
        channelId: channel.id,
        channelName: channel.name,
        kind: s.kind,
        sessionId: s.id,
        participantIds,
      });
      setActivityParticipants(participantIds);
    },
    [setActiveActivity, setActivityParticipants, guildId, channel.id, channel.name],
  );

  // Oturum üyeleri değişince overlay listesini güncelle
  useEffect(() => {
    if (!session || browsingOther) return;
    const ids = [...(session.playerIds ?? []), ...(session.spectatorIds ?? [])];
    setActivityParticipants(ids);
  }, [
    session?.playerIds,
    session?.spectatorIds,
    session,
    browsingOther,
    setActivityParticipants,
  ]);

  // Aktivite socket — üye gir/çık canlı
  useEffect(() => {
    if (browsingOther) return;
    client.connectSocket();
    client.joinChannel(channel.id);
    const sock = client.connectSocket();
    const onUpsert = (payload: ActivitySessionDto) => {
      if (payload.channelId !== channel.id) return;
      if (payload.status === 'ended') {
        setSession(null);
        return;
      }
      setSession(payload);
    };
    sock.on(SocketEvents.ACTIVITY_UPSERT, onUpsert);
    sock.on(SocketEvents.ACTIVITY_STATE, onUpsert);
    sock.on(SocketEvents.ACTIVITY_LEAVE, onUpsert);
    return () => {
      sock.off(SocketEvents.ACTIVITY_UPSERT, onUpsert);
      sock.off(SocketEvents.ACTIVITY_STATE, onUpsert);
      sock.off(SocketEvents.ACTIVITY_LEAVE, onUpsert);
    };
  }, [client, channel.id, browsingOther]);

  const refresh = useCallback(async () => {
    const s = await client.getChannelActivity(guildId, channel.id);
    setSession(s);
    return s;
  }, [client, guildId, channel.id]);

  const enterRoom = useCallback(async () => {
    if (leftRef.current) return null;
    let s = await refresh();
    if (leftRef.current) return null;
    if (!s) s = await client.startActivity({ guildId, channelId: channel.id });
    setSession(s);
    if (
      user &&
      s &&
      !s.playerIds.includes(user.id) &&
      !s.spectatorIds.includes(user.id)
    ) {
      if (leftRef.current) return null;
      s = await client.joinActivity(s.id, false);
      setSession(s);
    }
    if (s && !leftRef.current) remember(s);
    return s;
  }, [client, guildId, channel.id, refresh, user, remember]);

  const leaveRoom = useCallback(async () => {
    leftRef.current = true;
    const sid = session?.id ?? activitySessionId;
    clearActiveActivity();
    setSession(null);
    if (sid) {
      await client.leaveActivity(sid).catch(() => undefined);
    }
    try {
      const channels = await client.getGuildChannels(guildId);
      const text = channels.find((c) => c.type === 'TEXT');
      if (text) {
        router.replace(`/(app)/channels/${guildId}/${text.id}`);
        return;
      }
    } catch {
      /* ignore */
    }
    router.replace('/(app)/guilds');
  }, [
    session?.id,
    activitySessionId,
    clearActiveActivity,
    client,
    guildId,
    router,
  ]);

  useEffect(() => {
    if (browsingOther) {
      setSession(null);
      setError(null);
      return;
    }
    leftRef.current = false;
    void (async () => {
      try {
        setError(null);
        await enterRoom();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Aktivite açılamadı');
      }
    })();
    // enterRoom bilinçli dışarıda — ses odası ile aynı
  }, [guildId, channel.id, browsingOther]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchToThisChannel = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      if (activitySessionId && activityChannelId !== channel.id) {
        await client.leaveActivity(activitySessionId).catch(() => undefined);
        clearActiveActivity();
      }
      await enterRoom();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Katılınamadı');
    } finally {
      setJoining(false);
    }
  }, [
    activitySessionId,
    activityChannelId,
    clearActiveActivity,
    client,
    channel.id,
    enterRoom,
  ]);

  const patch = async (state: Record<string, unknown>) => {
    if (!session) return;
    setBusy(true);
    try {
      setSession(await client.patchActivityState(session.id, state));
    } finally {
      setBusy(false);
    }
  };

  if (showChat) {
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
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Aktiviteye dön</Text>
        </Pressable>
        <ChatView channel={channel} hideChannelChrome />
      </View>
    );
  }

  if (error && !browsingOther) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.danger }}>{error}</Text>
      </View>
    );
  }

  if (browsingOther) {
    return (
      <View style={{ flex: 1 }}>
        <ActivityHeader
          channelName={channel.name}
          busy={busy || joining}
          onRefresh={() => void refresh()}
          onChat={() => setShowChat(true)}
        />
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
            Şu an “{activityChannelName ?? 'başka bir aktivite'}” odasındasın. Bu odayı
            sadece göz gezdiriyorsun — katılınca mevcut aktiviteden ayrılırsın.
          </Text>
          {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
          <Pressable
            style={{ ...primaryBtn, opacity: joining ? 0.6 : 1 }}
            disabled={joining}
            onPress={() => void switchToThisChannel()}
          >
            <Text style={primaryBtnText}>{joining ? 'Katılıyor…' : 'Bu kanala katıl'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!session || !user) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textMuted }}>Oda hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      {!gameLandscapeFs ? (
        <ActivityHeader
          channelName={channel.name}
          busy={busy}
          onRefresh={() => void refresh()}
          onChat={() => setShowChat(true)}
          onLeave={() => void leaveRoom()}
        />
      ) : null}

      {session.kind === 'watch_party' ? (
        <WatchPartyNative session={session} userId={user.id} onPatch={patch} />
      ) : (
        // Tavla / bilardo / bowling / okey / blackjack — web/desktop ile aynı Three.js
        <GameWebEmbed
          guildId={guildId}
          channelId={channel.id}
          onLandscapeFullscreenChange={setGameLandscapeFs}
          onActivityLeave={() => void leaveRoom()}
        />
      )}
    </View>
  );
}

function ActivityHeader({
  channelName,
  busy,
  onRefresh,
  onChat,
  onLeave,
}: {
  channelName: string;
  busy: boolean;
  onRefresh: () => void;
  onChat: () => void;
  onLeave: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceHigh,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
        {channelName}
      </Text>
      <Pressable
        onPress={onChat}
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
      <Pressable onPress={onRefresh} disabled={busy} hitSlop={8}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>↻</Text>
      </Pressable>
      <Pressable
        onPress={onLeave}
        hitSlop={8}
        style={{
          paddingHorizontal: 10,
          height: 32,
          borderRadius: 8,
          backgroundColor: 'rgba(255,85,85,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel="Ayrıl"
      >
        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>Ayrıl</Text>
      </Pressable>
    </View>
  );
}

function fmtWatchTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function WatchPartyNative({
  session,
  userId,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId: string;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const st = watchPartyParseState(session.state as Record<string, unknown>);
  const isHost = session.hostUserId === userId;
  const [url, setUrl] = useState(st.mediaUrl);
  const [busy, setBusy] = useState(false);
  const webRef = useRef<SafeWebViewHandle | null>(null);
  const ytReady = useRef(false);
  const lastApplied = useRef({ at: -1, playing: false, url: '' });

  const media = useMemo(
    () => (st.mediaUrl ? resolveWatchMedia(st.mediaUrl) : null),
    [st.mediaUrl],
  );
  const isYoutube = media?.provider === 'youtube' && Boolean(media.id);
  const isEmbed = Boolean(media && !media.isDirectFile);
  const directUri = media?.isDirectFile ? media.sourceUrl : null;

  const player = useVideoPlayer(directUri || null, (p) => {
    p.loop = false;
  });

  const broadcast = useCallback(
    async (patch: Record<string, unknown>) => {
      setBusy(true);
      try {
        await onPatch({
          mediaUrl: st.mediaUrl,
          playing: st.playing,
          at: st.at,
          ...patch,
        });
      } finally {
        setBusy(false);
      }
    },
    [onPatch, st.mediaUrl, st.playing, st.at],
  );

  const localAt = () => {
    if (directUri) {
      try {
        return Number(player.currentTime) || 0;
      } catch {
        return st.at;
      }
    }
    return st.at;
  };

  useEffect(() => {
    setUrl(st.mediaUrl);
  }, [st.mediaUrl]);

  useEffect(() => {
    if (!directUri) return;
    void player.replaceAsync(directUri).catch(() => undefined);
  }, [directUri, player]);

  // Doğrudan dosya — oturum state’ine senkron
  useEffect(() => {
    if (!directUri) return;
    try {
      const target = Number(st.at) || 0;
      if (Math.abs(player.currentTime - target) > 1.5) {
        player.currentTime = target;
      }
      if (st.playing) player.play();
      else player.pause();
      lastApplied.current = { at: target, playing: st.playing, url: st.mediaUrl };
    } catch {
      /* ignore */
    }
  }, [st.playing, st.at, st.mediaUrl, directUri, player]);

  // YouTube — WebView IFrame API’ye komut
  useEffect(() => {
    if (!isYoutube) return;
    const key = `${st.mediaUrl}|${st.at}|${st.playing}`;
    const prev = lastApplied.current;
    const same =
      prev.url === st.mediaUrl &&
      prev.playing === st.playing &&
      Math.abs(prev.at - st.at) < 0.4;
    if (same && ytReady.current) return;

    const apply = () => {
      webRef.current?.sendYoutubeCmd({
        type: 'seek',
        at: Number(st.at) || 0,
        playing: st.playing,
      });
      lastApplied.current = {
        at: Number(st.at) || 0,
        playing: st.playing,
        url: st.mediaUrl,
      };
    };

    if (ytReady.current) apply();
    else {
      // ready gelene kadar son komutu sakla — onYoutubeMessage ready’de tekrarlar
      lastApplied.current = {
        at: Number(st.at) || 0,
        playing: st.playing,
        url: st.mediaUrl,
      };
    }
    void key;
  }, [isYoutube, st.playing, st.at, st.mediaUrl, session.updatedAt]);

  const onYoutubeMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (msg.type === 'ready') {
        ytReady.current = true;
        webRef.current?.sendYoutubeCmd({
          type: 'seek',
          at: Number(st.at) || 0,
          playing: st.playing,
        });
      }
    },
    [st.at, st.playing],
  );

  // URL değişince YT ready sıfırla
  useEffect(() => {
    ytReady.current = false;
  }, [media?.id, st.mediaUrl]);

  const togglePlay = () => {
    const at = localAt();
    void broadcast({ playing: !st.playing, at });
  };

  const seekBy = (delta: number) => {
    const next = Math.max(0, localAt() + delta);
    void broadcast({ at: next, playing: st.playing });
  };

  const resync = () => {
    void broadcast({ at: localAt(), playing: st.playing });
  };

  const viewers = session.playerIds.length + session.spectatorIds.length;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 10 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }} numberOfLines={2}>
          {isHost ? 'Moderatörsün' : 'Senkron kontroller herkese yayınlanır'}
          {st.mediaUrl
            ? ` · ${st.playing ? 'Oynatılıyor' : 'Duraklatıldı'} · ${fmtWatchTime(st.at)} · ${viewers} kişi`
            : ''}
        </Text>
      </View>

      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="YouTube / Vimeo / Twitch / mp4 URL"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        style={{
          height: 44,
          borderRadius: 12,
          paddingHorizontal: 12,
          backgroundColor: colors.surface,
          color: colors.text,
        }}
      />
      <Pressable
        disabled={busy || !url.trim()}
        onPress={() => {
          ytReady.current = false;
          void broadcast({ mediaUrl: url.trim(), playing: false, at: 0 });
        }}
        style={{
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.surfaceHigh,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy || !url.trim() ? 0.5 : 1,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700' }}>URL ayarla</Text>
      </Pressable>

      {!st.mediaUrl ? (
        <Text style={{ color: colors.textMuted }}>Host medya URL’i ayarlamadı</Text>
      ) : isYoutube && media ? (
        <View style={{ height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
          <SafeWebView
            ref={webRef}
            uri={media.embedUrl}
            label={media.label}
            youtubeId={media.id}
            youtubeStartAt={Number(st.at) || 0}
            onYoutubeMessage={onYoutubeMessage}
            style={{ flex: 1, backgroundColor: '#000' }}
          />
        </View>
      ) : isEmbed && media ? (
        <View>
          <View
            style={{
              height: 220,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: '#000',
            }}
          >
            <SafeWebView
              uri={media.embedUrl}
              label={media.label}
              style={{ flex: 1, backgroundColor: '#000' }}
            />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
            {media.label} · senkron butonları zamanı paylaşır; oynatıcıyı da elle eşitleyin
          </Text>
        </View>
      ) : directUri ? (
        <VideoView
          player={player}
          style={{ width: '100%', height: 220, backgroundColor: '#000', borderRadius: 12 }}
          contentFit="contain"
          nativeControls={false}
        />
      ) : (
        <Text style={{ color: colors.danger }}>
          Bu bağlantı çözülemedi. Doğrudan video dosyası veya YouTube/Vimeo/Twitch URL’si
          deneyin.
        </Text>
      )}

      {st.mediaUrl ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              disabled={busy}
              onPress={() => seekBy(-10)}
              style={syncBtn}
              accessibilityLabel="10 saniye geri"
            >
              <Text style={syncBtnText}>−10s</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={togglePlay}
              style={{ ...syncBtn, flex: 1.4, backgroundColor: colors.primary }}
              accessibilityLabel={st.playing ? 'Duraklat' : 'Oynat'}
            >
              <Text style={{ ...syncBtnText, color: colors.primaryOn }}>
                {st.playing ? 'Duraklat' : 'Oynat'}
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => seekBy(10)}
              style={syncBtn}
              accessibilityLabel="10 saniye ileri"
            >
              <Text style={syncBtnText}>+10s</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              disabled={busy}
              onPress={resync}
              style={{ ...syncBtn, flex: 1 }}
              accessibilityLabel="Herkesi eşitle"
            >
              <Text style={syncBtnText}>Herkesi eşitle</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void broadcast({ at: 0, playing: false })}
              style={{ ...syncBtn, flex: 1 }}
              accessibilityLabel="Başa sar"
            >
              <Text style={syncBtnText}>Başa sar</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>
            Oynat / duraklat / seek tüm odadaki istemcilere senkronlanır
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const syncBtn = {
  flex: 1,
  height: 44,
  borderRadius: 12,
  backgroundColor: colors.surfaceHigh,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const syncBtnText = {
  color: colors.text,
  fontWeight: '700' as const,
  fontSize: 14,
};
