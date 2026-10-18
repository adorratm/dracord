'use client';

import type { ActivityKind, ActivitySessionDto, ChannelSummary } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useVoiceSession } from '@/components/VoiceSessionProvider';
import { BilliardsGame } from '@/components/activities/games/BilliardsGame';
import { BlackjackGame } from '@/components/activities/games/BlackjackGame';
import { BowlingGame } from '@/components/activities/games/BowlingGame';
import { OkeyGame } from '@/components/activities/games/OkeyGame';
import { TavlaGame } from '@/components/activities/games/TavlaGame';
import { TriviaGame } from '@/components/activities/games/TriviaGame';
import { WordsGame } from '@/components/activities/games/WordsGame';
import { WatchPartyRoom } from '@/components/activities/games/WatchPartyRoom';
import { GameAudio } from '@/lib/game-audio';
import { ActivityStageShell } from '@/components/activities/ActivityStageShell';
import { trackGameJoin } from '@/lib/analytics';
import type { ReactNode } from 'react';

const KIND_LABEL: Record<ActivityKind, string> = {
  billiards: 'Bilardo',
  okey: 'Okey',
  bowling: 'Bowling',
  tavla: 'Tavla',
  blackjack: '21 Blackjack',
  trivia: 'Trivia',
  words: 'Kelime',
  watch_party: 'Watch Party',
};

const KIND_ICON: Record<ActivityKind, string> = {
  billiards: 'sports_bar',
  okey: 'grid_view',
  bowling: 'sports_baseball',
  tavla: 'casino',
  blackjack: 'style',
  trivia: 'quiz',
  words: 'spellcheck',
  watch_party: 'live_tv',
};

function errMsg(e: unknown, fallback: string) {
  if (!(e instanceof Error) || !e.message) return fallback;
  // Boş JSON gövdesi / geçici ağ hatalarını kullanıcıya gösterme
  if (/unexpected end of json|geçersiz sunucu yanıtı/i.test(e.message)) {
    return fallback === 'Aktivite yüklenemedi' ? '' : fallback;
  }
  return e.message;
}

/** GAME / WATCH_PARTY kanalları için tam yükseklikte aktivite görünümü */
export function ActivityChannelView({
  guildId,
  channel,
  className,
  onOpenChannels,
  chatPanel,
  participantsPanel,
  chatOpen = false,
  participantsOpen = false,
  onToggleChat,
  onToggleParticipants,
  chatPanelWidth,
  onChatPanelWidthChange,
  participantsPanelWidth,
  onParticipantsPanelWidthChange,
  /** Mobil WebView — site kabuğu yok, yalnızca oyun sahnesi */
  embedMode = false,
}: {
  guildId: string;
  channel: ChannelSummary;
  className?: string;
  onOpenChannels?: () => void;
  chatPanel?: ReactNode;
  participantsPanel?: ReactNode;
  chatOpen?: boolean;
  participantsOpen?: boolean;
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
  chatPanelWidth?: number;
  onChatPanelWidthChange?: (w: number) => void;
  participantsPanelWidth?: number;
  onParticipantsPanelWidthChange?: (w: number) => void;
  embedMode?: boolean;
}) {
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const router = useRouter();
  const channelId = channel.id;

  // Oyuna / watch party’ye girince mevcut sesten çıkıp bu odanın sesine geç
  useEffect(() => {
    if (!user) return;
    if (voice.voiceChannelId === channelId && voice.voiceGuildId === guildId) return;
    let cancelled = false;
    void (async () => {
      try {
        GameAudio.unlock();
        await voice.join(channelId, guildId);
      } catch {
        if (!cancelled) {
          /* şifre / izin — kullanıcı yine aktiviteyi görebilir */
        }
      }
    })();
    return () => {
      cancelled = true;
      // Embed: native Ayrıl WebView’ı unmount eder — presence burada da kopsun
      if (embedMode && voice.voiceChannelId === channelId) {
        voice.leave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sadece kanal değişiminde
  }, [channelId, guildId, user?.id, embedMode]);
  const [session, setSession] = useState<ActivitySessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = session?.id ?? null;

  const me = user?.id;
  const [guildNameById, setGuildNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void client
      .getGuildMembers(guildId)
      .then((members) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const m of members) {
          map[m.id] = m.displayName || m.username || m.id;
        }
        setGuildNameById(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, guildId]);

  const nameByUserId = useMemo(() => {
    const map: Record<string, string> = { ...guildNameById };
    if (user) {
      map[user.id] = user.displayName || user.username || map[user.id] || user.id;
    }
    for (const p of voice.participants) {
      const n = p.displayName?.trim();
      if (n) map[p.id] = n;
    }
    return map;
  }, [guildNameById, user, voice.participants]);

  const refresh = useCallback(async (): Promise<ActivitySessionDto | null> => {
    try {
      const s = await client.getChannelActivity(guildId, channelId);
      setSession(s);
      return s;
    } catch (e) {
      setError(errMsg(e, 'Aktivite yüklenemedi'));
      return null;
    }
  }, [client, guildId, channelId]);

  const startNew = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await client.startActivity({ guildId, channelId });
      setSession(s);
      trackGameJoin(s.kind, guildId);
    } catch (e) {
      // Aynı anda başka biri başlattıysa mevcut oturumu al
      const s = await refresh();
      if (!s) setError(errMsg(e, 'Aktivite başlatılamadı'));
    } finally {
      setBusy(false);
    }
  }, [client, guildId, channelId, refresh]);

  // Kanal değişince: oturumu getir, yoksa başlat, üye değilse katıl
  useEffect(() => {
    let cancelled = false;
    setSession(null);
    setLoading(true);
    setError(null);
    bootRef.current = null;
    void (async () => {
      let s = await refresh();
      if (cancelled) return;
      if (!s) {
        try {
          s = await client.startActivity({ guildId, channelId });
          if (cancelled) return;
          setSession(s);
        } catch (e) {
          s = await refresh();
          if (cancelled) return;
          if (!s) setError(errMsg(e, 'Aktivite başlatılamadı'));
        }
      }
      if (cancelled) return;
      if (s && me && !s.playerIds.includes(me) && !s.spectatorIds.includes(me)) {
        // Watch Party'de oda herkese açık; izleyici olarak otomatik katıl
        if (s.kind === 'watch_party') {
          try {
            const joined = await client.joinActivity(s.id, true);
            if (!cancelled) setSession(joined);
          } catch {
            /* lobi arayüzü kalan seçenekleri sunar */
          }
        }
      }
      bootRef.current = channelId;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, guildId, channelId, me]);

  // Socket olayları
  useEffect(() => {
    client.joinChannel(channelId);
    const sock = client.connectSocket();
    const onUpsert = (payload: ActivitySessionDto) => {
      if (payload.channelId !== channelId) return;
      if (payload.status === 'ended') setSession(null);
      else setSession(payload);
    };
    const onLeave = (payload: ActivitySessionDto) => {
      if (payload.channelId !== channelId) return;
      if (payload.status === 'ended') setSession(null);
      else setSession(payload);
    };
    sock.on(SocketEvents.ACTIVITY_UPSERT, onUpsert);
    sock.on(SocketEvents.ACTIVITY_STATE, onUpsert);
    sock.on(SocketEvents.ACTIVITY_LEAVE, onLeave);
    return () => {
      sock.off(SocketEvents.ACTIVITY_UPSERT, onUpsert);
      sock.off(SocketEvents.ACTIVITY_STATE, onUpsert);
      sock.off(SocketEvents.ACTIVITY_LEAVE, onLeave);
    };
  }, [client, channelId]);

  // Kanaldan / ekrandan çıkınca "Oynuyor" presence kalsın diye leave
  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      void client.leaveActivity(sid).catch(() => undefined);
    };
  }, [client, channelId]);

  const join = async (spectator: boolean) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      setSession(await client.joinActivity(session.id, spectator));
    } catch (e) {
      setError(errMsg(e, 'Katılınamadı'));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await client.leaveActivity(session.id);
      if (voice.voiceChannelId === channelId) {
        voice.leave();
      }
      // Mobil WebView: native ActivitySession + rota temizlensin (aksi halde auto-join)
      if (embedMode && typeof window !== 'undefined' && window.ReactNativeWebView) {
        try {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'dracord-activity-leave',
              sessionId: session.id,
              guildId,
              channelId,
            }),
          );
        } catch {
          /* ignore */
        }
        return;
      }
      await refresh();
      try {
        const channels = await client.getGuildChannels(guildId);
        const text = channels.find((c) => c.type === 'TEXT');
        if (text) router.push(`/channels/${guildId}/${text.id}`);
      } catch {
        // kal
      }
    } catch (e) {
      setError(errMsg(e, 'Ayrılınamadı'));
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await client.endActivity(session.id);
      setSession(null);
      if (voice.voiceChannelId === channelId) {
        voice.leave();
      }
      try {
        const channels = await client.getGuildChannels(guildId);
        const text = channels.find((c) => c.type === 'TEXT');
        if (text) router.push(`/channels/${guildId}/${text.id}`);
      } catch {
        // kal
      }
    } catch (e) {
      setError(errMsg(e, 'Bitirilemedi'));
    } finally {
      setBusy(false);
    }
  };

  const patch = useCallback(
    async (state: Record<string, unknown>) => {
      const id = sessionIdRef.current;
      if (!id) return;
      try {
        const s = await client.patchActivityState(id, state);
        setSession(s);
      } catch (e) {
        setError(errMsg(e, 'Durum güncellenemedi'));
        void refresh();
        throw e;
      }
    },
    [client, refresh],
  );

  const isPlayer = Boolean(me && session?.playerIds.includes(me));
  const isSpectator = Boolean(me && session?.spectatorIds.includes(me));
  const isHost = Boolean(me && session?.hostUserId === me);
  const isMember = isPlayer || isSpectator;
  const full = Boolean(session && session.playerIds.length >= session.maxPlayers);
  const waiting = Boolean(
    session &&
      session.kind !== 'watch_party' &&
      session.status === 'lobby' &&
      session.playerIds.length < session.minPlayers,
  );
  const kind: ActivityKind | null = session?.kind ?? null;

  const header = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))]">
      {onOpenChannels && (
        <button
          type="button"
          className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface"
          aria-label="Kanallar"
          onClick={onOpenChannels}
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
      )}
      <span className="flex min-w-0 items-center gap-1.5 font-headline-md text-on-surface">
        <span className="material-symbols-outlined shrink-0 text-[20px] text-[#bd93f9]">
          {kind ? KIND_ICON[kind] : 'sports_esports'}
        </span>
        <span className="truncate">{channel.name}</span>
      </span>
      {session && (
        <>
          <span className="hidden rounded-md bg-[#bd93f9]/15 px-2 py-0.5 font-label-sm uppercase text-[#bd93f9] sm:inline">
            {KIND_LABEL[session.kind]}
          </span>
          <span className="hidden font-label-sm text-outline sm:inline">
            {session.playerIds.length}/{session.maxPlayers} oyuncu
            {session.spectatorIds.length > 0
              ? ` · ${session.spectatorIds.length} izleyici`
              : ''}
          </span>
        </>
      )}
      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto sm:gap-2">
        {session && !isMember && (
          <>
            {!full && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void join(false)}
                className="h-8 rounded-lg bg-[#bd93f9] px-2.5 font-label-sm text-[#11131e] disabled:opacity-50 sm:px-3"
              >
                {session.kind === 'watch_party' ? 'Katıl' : 'Katıl'}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void join(true)}
              className="h-8 rounded-lg bg-surface-container-high px-2.5 font-label-sm text-on-surface disabled:opacity-50 sm:px-3"
            >
              İzle
            </button>
          </>
        )}
        {session && isSpectator && !isPlayer && !full && session.kind !== 'watch_party' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void join(false)}
            className="h-8 rounded-lg bg-[#bd93f9] px-2.5 font-label-sm text-[#11131e] disabled:opacity-50"
          >
            Oyuna geç
          </button>
        )}
        {session && isMember && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void leave()}
            className="h-8 rounded-lg px-2.5 font-label-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
          >
            Ayrıl
          </button>
        )}
        {session && isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void end()}
            className="h-8 rounded-lg px-2.5 font-label-sm text-error hover:bg-error/10 disabled:opacity-50"
          >
            Bitir
          </button>
        )}
      </div>
    </div>
  );

  const stage = (
    <>
      {error ? (
        <p className="shrink-0 bg-error/10 px-space-md py-1 font-body-sm text-error">{error}</p>
      ) : null}

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center font-body-sm text-outline">
            Oda hazırlanıyor…
          </div>
        ) : !session ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="material-symbols-outlined text-[44px] text-[#bd93f9]">
              sports_esports
            </span>
            <p className="font-body-md text-on-surface-variant">
              Bu kanalda aktif bir oturum yok.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startNew()}
              className="h-9 rounded-lg bg-[#bd93f9] px-4 font-label-sm text-[#11131e] disabled:opacity-50"
            >
              Yeni oturum başlat
            </button>
          </div>
        ) : (
          <>
            {session.kind === 'billiards' && (
              <BilliardsGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'okey' && (
              <OkeyGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'bowling' && (
              <BowlingGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'tavla' && (
              <TavlaGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'blackjack' && (
              <BlackjackGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                onLeave={() => void leave()}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'trivia' && (
              <TriviaGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'words' && (
              <WordsGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'watch_party' && (
              <WatchPartyRoom
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                isHost={isHost}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}

            {waiting && (
              <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-4">
                <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-xl border border-[#bd93f9]/40 bg-[#11131e]/90 px-4 py-2 shadow-lg">
                  <span className="font-label-sm text-on-surface">
                    Oyuncu bekleniyor · {session.playerIds.length}/{session.minPlayers}
                  </span>
                  {!isMember && !full && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void join(false)}
                      className="h-8 rounded-lg bg-[#bd93f9] px-3 font-label-sm text-[#11131e] disabled:opacity-50"
                    >
                      Katıl
                    </button>
                  )}
                  {!isMember && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void join(true)}
                      className="h-8 rounded-lg bg-surface-container-high px-3 font-label-sm text-on-surface disabled:opacity-50"
                    >
                      İzle
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  if (embedMode) {
    // Mobil WebView: üst bar + Ayrıl native ActivityRoom’da — embed’de gösterme
    return (
      <div
        className={
          className ?? 'flex h-[100dvh] w-full flex-col overflow-hidden bg-[#11131e]'
        }
      >
        {stage}
      </div>
    );
  }

  return (
    <ActivityStageShell
      className={className}
      header={header}
      chatPanel={chatPanel}
      participantsPanel={participantsPanel}
      chatOpen={chatOpen}
      participantsOpen={participantsOpen}
      onToggleChat={onToggleChat}
      onToggleParticipants={onToggleParticipants}
      chatPanelWidth={chatPanelWidth}
      onChatPanelWidthChange={onChatPanelWidthChange}
      participantsPanelWidth={participantsPanelWidth}
      onParticipantsPanelWidthChange={onParticipantsPanelWidthChange}
    >
      {stage}
    </ActivityStageShell>
  );
}
