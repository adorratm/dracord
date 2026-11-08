import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import { GAME_EMBED, SocketEvents, type GameAppDto, type GameLaunchDto, type GameSessionDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from './Icon';
import { SafeWebView, type SafeWebViewHandle } from './SafeWebView';

/** Mobil: ses kanalındaki harici oyun oturumları (web useGameSessions eşi) */
export function useMobileGameSessions(client: DracordClient, guildId: string | null | undefined, channelId: string | null | undefined) {
  const [sessions, setSessions] = useState<GameSessionDto[]>([]);
  useEffect(() => {
    setSessions([]);
    if (!guildId || !channelId) return;
    void client.listGameSessions(guildId, channelId).then(setSessions).catch(() => undefined);
    const sock = client.connectSocket();
    const onUpd = (s: GameSessionDto) => {
      if (s.guildId !== guildId || s.channelId !== channelId) return;
      setSessions((prev) => {
        const rest = prev.filter((x) => x.id !== s.id);
        return s.status === 'active' ? [...rest, s] : rest;
      });
    };
    sock.on(SocketEvents.GAME_SESSION_UPDATE, onUpd);
    return () => {
      sock.off(SocketEvents.GAME_SESSION_UPDATE, onUpd);
    };
  }, [client, guildId, channelId]);
  return sessions;
}

/** Oyun seçici + aktif oturumlar (ses odası içinde) */
export function GamesStrip({
  client,
  guildId,
  channelId,
  sessions,
  onOpen,
}: {
  client: DracordClient;
  guildId: string;
  channelId: string;
  sessions: GameSessionDto[];
  onOpen: (s: GameSessionDto) => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalog, setCatalog] = useState<Array<GameAppDto & { testMode: boolean }> | null>(null);

  useEffect(() => {
    if (!catalogOpen || catalog) return;
    void client.getGameCatalog().then((c) => setCatalog(c.filter((g) => g.platforms.includes('mobile')))).catch(() => setCatalog([]));
  }, [catalogOpen, catalog, client]);

  const start = async (gameId: string) => {
    setCatalogOpen(false);
    try {
      onOpen(await client.startGameSession(gameId, guildId, channelId));
    } catch (e) {
      Alert.alert('Oyun', e instanceof Error ? e.message : 'Başlatılamadı');
    }
  };
  const join = async (s: GameSessionDto) => {
    try {
      onOpen(await client.joinGameSession(s.id));
    } catch (e) {
      Alert.alert('Oyun', e instanceof Error ? e.message : 'Katılınamadı');
    }
  };

  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh }}>
      {sessions.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => void join(s)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceHigh }}
        >
          <Icon name="sports_esports" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {s.game.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{s.participantIds.length} oyuncu · Katıl</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => setCatalogOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="add_circle" size={18} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Oyun başlat</Text>
      </Pressable>
      <Modal visible={catalogOpen} transparent animationType="slide" onRequestClose={() => setCatalogOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setCatalogOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 8, maxHeight: '75%' }}
          >
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Oyun başlat</Text>
            {catalog === null ? (
              <Text style={{ color: colors.textMuted }}>Yükleniyor…</Text>
            ) : catalog.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Mobilde oynanabilen yayında oyun yok.</Text>
            ) : (
              catalog.map((g) => (
                <Pressable key={g.id} onPress={() => void start(g.id)} style={{ padding: 10, borderRadius: 10, backgroundColor: colors.surfaceHigh }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {g.name}
                    {g.testMode ? '  · TEST' : ''}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                    {g.shortDescription || `${g.minPlayers}–${g.maxPlayers} oyuncu`}
                  </Text>
                </Pressable>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Tam ekran oyun (RN WebView köprüsü — @dracord/embedded-sdk ReactNativeWebView yolu) */
export function MobileGameFrame({
  client,
  session,
  resolveParticipant,
  onClose,
  onSetStatus,
}: {
  client: DracordClient;
  session: GameSessionDto;
  resolveParticipant: (id: string) => { id: string; displayName: string; avatarUrl: string | null };
  onClose: (opts?: { leave?: boolean }) => void;
  onSetStatus?: (t: string | null) => void;
}) {
  const web = useRef<SafeWebViewHandle | null>(null);
  const launched = useRef<GameLaunchDto | null>(null);
  let origin = '';
  try {
    origin = new URL(session.game.entryUrl).origin;
  } catch {
    /* geçersiz */
  }

  const post = useCallback((type: string, payload: unknown) => {
    const msg = JSON.stringify({ source: GAME_EMBED.hostSource, type, payload });
    web.current?.injectJavaScript(
      `try{window.dispatchEvent(new MessageEvent('message',{data:${msg},origin:${JSON.stringify(GAME_EMBED.nativeOrigin)}}));}catch(e){};true;`,
    );
  }, []);

  const participants = useCallback((s: GameSessionDto) => s.participantIds.map(resolveParticipant), [resolveParticipant]);

  useEffect(() => {
    if (launched.current) post('SESSION_UPDATE', { session: { ...session, game: undefined }, participants: participants(session) });
  }, [session, post, participants]);

  const onBridge = async (m: Record<string, unknown>) => {
    if (m.source !== GAME_EMBED.embedSource) return;
    const payload = (m.payload ?? {}) as Record<string, unknown>;
    switch (m.type) {
      case 'READY':
      case 'REFRESH_TOKEN': {
        try {
          const l = await client.launchGameSession(session.id);
          launched.current = l;
          if (m.type === 'READY') {
            post('INIT', {
              protocol: GAME_EMBED.version,
              token: l.token,
              expiresAt: l.expiresAt,
              user: l.user,
              session: { ...l.session, game: undefined },
              participants: participants(l.session),
              platform: 'mobile',
              locale: 'tr-TR',
              theme: 'dark',
              testMode: l.session.game.status !== 'approved',
              apiBase: client.apiBaseUrl,
            });
          } else post('TOKEN', { token: l.token, expiresAt: l.expiresAt });
        } catch {
          post('ERROR', { code: 'launch_failed', message: 'Dracord oturumu açılamadı' });
        }
        break;
      }
      case 'CLOSE':
        onClose();
        break;
      case 'OPEN_EXTERNAL': {
        const url = String(payload.url ?? '');
        if (/^https:\/\//i.test(url)) {
          Alert.alert('Harici bağlantı', url, [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Aç', onPress: () => void Linking.openURL(url).catch(() => undefined) },
          ]);
        }
        break;
      }
      case 'TOAST':
        break;
      case 'SET_STATUS':
        onSetStatus?.(payload.text ? String(payload.text).slice(0, 100) : null);
        break;
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => onClose({ leave: false })} supportedOrientations={['portrait', 'landscape']}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 40, paddingBottom: 8, backgroundColor: colors.surface }}>
          <Icon name="sports_esports" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {session.game.name}
            {session.game.status !== 'approved' ? '  · TEST' : ''}
          </Text>
          <Pressable onPress={() => onClose({ leave: false })} hitSlop={8} style={{ padding: 6 }}>
            <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Küçült</Text>
          </Pressable>
          <Pressable onPress={() => onClose({ leave: true })} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.danger }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Çık</Text>
          </Pressable>
        </View>
        {origin ? (
          <SafeWebView
            ref={web}
            uri={session.game.entryUrl}
            label={session.game.name}
            lockToOrigin={origin}
            onBridgeMessage={(m) => void onBridge(m)}
          />
        ) : (
          <Text style={{ color: colors.danger, padding: 16 }}>Oyun adresi geçersiz.</Text>
        )}
      </View>
    </Modal>
  );
}
