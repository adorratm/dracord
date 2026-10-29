import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityKind, ActivitySessionDto, ChannelSummary, PublicUser } from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { getActivityConflictSession, SocketEvents } from '@dracord/sdk';
import { MemberList, type MemberListGroup } from '@dracord/ui';
import { BilliardsGame } from '../../../web/components/activities/games/BilliardsGame';
import { BlackjackGame } from '../../../web/components/activities/games/BlackjackGame';
import { BowlingGame } from '../../../web/components/activities/games/BowlingGame';
import { OkeyGame } from '../../../web/components/activities/games/OkeyGame';
import { TavlaGame } from '../../../web/components/activities/games/TavlaGame';
import { TriviaGame } from '../../../web/components/activities/games/TriviaGame';
import { WordsGame } from '../../../web/components/activities/games/WordsGame';
import { WatchPartyRoom } from '../../../web/components/activities/games/WatchPartyRoom';
import { ActivityStageShell } from '../../../web/components/activities/ActivityStageShell';
import { GameAudio } from '@/lib/game-audio';
import { useAuth } from '../auth';
import { useVoiceSession } from '../voice/VoiceSession';
import { ChatPanel } from './ChatPanel';

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
  if (/unexpected end of json|geçersiz sunucu yanıtı/i.test(e.message)) {
    return fallback === 'Aktivite yüklenemedi' ? '' : fallback;
  }
  return e.message;
}

export function ActivityPanel({
  guildId,
  channel,
  members = [],
  textChannels = [],
  onLeaveNavigate,
}: {
  guildId: string;
  channel: ChannelSummary;
  members?: PublicUser[];
  textChannels?: ChannelSummary[];
  /** Aktiviteden ayrıl / bitir sonrası metin kanalına geç */
  onLeaveNavigate?: () => void;
}) {
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const channelId = channel.id;
  const [session, setSession] = useState<ActivitySessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(340);
  const [partsWidth, setPartsWidth] = useState(280);
  const [chatChannelId, setChatChannelId] = useState<string | null>(
    () => textChannels.find((c) => c.type === 'TEXT')?.id ?? null,
  );
  const [dmChannel, setDmChannel] = useState<ChannelSummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const bootRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionVersionRef = useRef(0);
  sessionIdRef.current = session?.id ?? null;
  sessionVersionRef.current = session?.stateVersion ?? 0;

  const me = user?.id;
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});

  useEffect(() => {
    GameAudio.unlock();
  }, []);

  // Oyun / watch party = ses odası; web gibi kanala geçince LiveKit'e de katıl
  // type şart: AFK otomatik taşıma GAME/WATCH_PARTY'de çalışmaz
  const joinVoice = voice.join;
  useEffect(() => {
    void joinVoice(guildId, {
      id: channel.id,
      name: channel.name,
      type: channel.type,
    });
  }, [channel.id, channel.name, channel.type, guildId, joinVoice]);

  useEffect(() => {
    let cancelled = false;
    void client
      .getGuildMembers(guildId)
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const m of list) map[m.id] = m.displayName || m.username;
        setNameByUserId(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, guildId]);

  const refresh = useCallback(async () => {
    const s = await client.getChannelActivity(guildId, channelId);
    setSession(s);
    return s;
  }, [client, guildId, channelId]);

  useEffect(() => {
    let cancelled = false;
    const bootChannel = channelId;
    bootRef.current = bootChannel;
    setSession(null);
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        let s = await refresh();
        if (cancelled || bootRef.current !== bootChannel) return;
        if (!s) {
          s = await client.startActivity({ guildId, channelId: bootChannel });
        }
        if (cancelled || bootRef.current !== bootChannel) return;
        setSession(s);
        if (
          me &&
          s &&
          !s.playerIds.includes(me) &&
          !s.spectatorIds.includes(me)
        ) {
          setSession(await client.joinActivity(s.id, false));
        }
      } catch (e) {
        if (!cancelled && bootRef.current === bootChannel) {
          setError(errMsg(e, 'Aktivite yüklenemedi'));
        }
      } finally {
        if (!cancelled && bootRef.current === bootChannel) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // presence user objesi boot’u iptal edip loading’de bırakıyordu — yalnız id
  }, [client, guildId, channelId, refresh, me]);

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

  // Kanaldan / ekrandan çıkınca "Oynuyor" presence kalsın diye leave (web parity)
  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      void client.leaveActivity(sid).catch(() => undefined);
    };
  }, [client, channelId]);

  const kind: ActivityKind =
    session?.kind ??
    (channel.type === 'WATCH_PARTY' ? 'watch_party' : channel.gameKind) ??
    'blackjack';

  const isPlayer = Boolean(me && session?.playerIds.includes(me));
  const isSpectator = Boolean(me && session?.spectatorIds.includes(me));
  const isMember = isPlayer || isSpectator;
  const isHost = Boolean(me && session?.hostUserId === me);
  const full = Boolean(session && session.playerIds.length >= session.maxPlayers);
  const waiting = Boolean(
    session && session.playerIds.length < session.minPlayers && session.status !== 'ended',
  );

  const patch = async (state: Record<string, unknown>) => {
    const id = sessionIdRef.current;
    if (!id) return;
    setBusy(true);
    try {
      const next = await client.patchActivityState(id, state, {
        expectedVersion: sessionVersionRef.current,
      });
      sessionVersionRef.current = next.stateVersion ?? sessionVersionRef.current;
      setSession(next);
    } catch (e) {
      const conflict = getActivityConflictSession(e);
      if (conflict) {
        sessionVersionRef.current = conflict.stateVersion ?? sessionVersionRef.current;
        setSession(conflict);
        return;
      }
      setError(errMsg(e, 'Durum güncellenemedi'));
    } finally {
      setBusy(false);
    }
  };

  const join = async (asSpectator: boolean) => {
    if (!session) return;
    setBusy(true);
    try {
      setSession(await client.joinActivity(session.id, asSpectator));
    } catch (e) {
      setError(errMsg(e, 'Katılınamadı'));
    } finally {
      setBusy(false);
    }
  };

  /** Aktivite + watch party / oyun ses kanalından tamamen çık (web parity) */
  const leaveVoiceAndNavigate = async (chId: string) => {
    // Önce UI (ActivityPanel unmount) — auto-join effect tekrar bağlanmasın
    onLeaveNavigate?.();
    if (voice.voiceChannelId === chId) {
      await voice.leave();
    } else {
      await client.leaveVoiceState(chId).catch(() => undefined);
    }
  };

  const leave = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const chId = channelId;
      sessionIdRef.current = null;
      await client.leaveActivity(session.id);
      await leaveVoiceAndNavigate(chId);
    } catch (e) {
      setError(errMsg(e, 'Ayrılınamadı'));
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const chId = channelId;
      sessionIdRef.current = null;
      await client.endActivity(session.id);
      setSession(null);
      await leaveVoiceAndNavigate(chId);
    } catch (e) {
      setError(errMsg(e, 'Bitirilemedi'));
    } finally {
      setBusy(false);
    }
  };

  const startNew = async () => {
    setBusy(true);
    try {
      setSession(await client.startActivity({ guildId, channelId }));
    } catch (e) {
      setError(errMsg(e, 'Oturum başlatılamadı'));
    } finally {
      setBusy(false);
    }
  };

  const textOnly = useMemo(
    () => textChannels.filter((c) => c.type === 'TEXT'),
    [textChannels],
  );

  const chatChannel =
    dmChannel ??
    textOnly.find((c) => c.id === chatChannelId) ??
    textOnly[0] ??
    null;

  const chatTitle = dmChannel
    ? 'Direkt mesaj'
    : chatChannel
      ? `#${chatChannel.name}`
      : 'Kanal seç';

  const canDm = (id: string, isBot?: boolean) =>
    id !== me && !isBot && id !== DRACORD_BOT_USER_ID;

  const openDmWith = (targetUserId: string) => {
    const m = members.find((x) => x.id === targetUserId);
    if (!canDm(targetUserId, m?.isBot)) return;
    void client.openDm(targetUserId).then((ch) => {
      setDmChannel(ch);
      setChatChannelId(ch.id);
      setChatOpen(true);
      setPickerOpen(false);
    });
  };

  const participantGroups: MemberListGroup[] = useMemo(() => {
    if (!session) return [];
    const mapUser = (id: string, role: string) => {
      const m = members.find((x) => x.id === id);
      return {
        id,
        displayName: nameByUserId[id] ?? m?.displayName ?? id.slice(0, 8),
        username: m?.username,
        avatarUrl: m?.avatarUrl,
        status: (m?.status ?? 'ONLINE') as 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE',
        subtitle: role,
        isBot: Boolean(m?.isBot),
        onClick: canDm(id, m?.isBot) ? () => openDmWith(id) : undefined,
      };
    };
    const groups: MemberListGroup[] = [];
    if (session.playerIds.length) {
      groups.push({
        id: 'players',
        label: `Oyuncular — ${session.playerIds.length}`,
        members: session.playerIds.map((id) =>
          mapUser(id, session.hostUserId === id ? 'Host' : 'Oyuncu'),
        ),
      });
    }
    if (session.spectatorIds.length) {
      groups.push({
        id: 'spectators',
        label: `İzleyiciler — ${session.spectatorIds.length}`,
        members: session.spectatorIds.map((id) => mapUser(id, 'İzleyici')),
      });
    }
    return groups;
  }, [session, members, nameByUserId]);

  const header = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <span className="material-symbols-outlined text-[22px] text-[#bd93f9]">
        {KIND_ICON[kind]}
      </span>
      <span className="truncate font-headline-md text-on-surface">
        {channel.name} · {KIND_LABEL[kind]}
      </span>
      {session && (
        <span className="hidden font-label-sm text-outline sm:inline">
          {session.playerIds.length}/{session.maxPlayers} oyuncu
          {session.spectatorIds.length > 0 ? ` · ${session.spectatorIds.length} izleyici` : ''}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        {session && !isMember && (
          <>
            {!full && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void join(false)}
                className="h-8 rounded-lg bg-[#bd93f9] px-2.5 font-label-sm text-[#11131e] disabled:opacity-50"
              >
                Katıl
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void join(true)}
              className="h-8 rounded-lg bg-surface-container-high px-2.5 font-label-sm text-on-surface disabled:opacity-50"
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

  return (
    <ActivityStageShell
      className="h-full"
      header={header}
      chatOpen={chatOpen}
      participantsOpen={participantsOpen}
      onToggleChat={() => setChatOpen((v) => !v)}
      onToggleParticipants={() => setParticipantsOpen((v) => !v)}
      chatPanelWidth={chatWidth}
      onChatPanelWidthChange={setChatWidth}
      participantsPanelWidth={partsWidth}
      onParticipantsPanelWidthChange={setPartsWidth}
      chatPanel={
        chatOpen ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-surface-container-high px-2">
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  className="w-full h-8 px-2 rounded-lg bg-surface-container-highest text-left font-body-sm truncate flex items-center gap-1"
                  onClick={() => setPickerOpen((v) => !v)}
                >
                  <span className="truncate">{chatTitle}</span>
                  <span className="material-symbols-outlined text-[16px] text-outline ml-auto">
                    expand_more
                  </span>
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-surface-container-highest bg-surface-container-low shadow-float max-h-48 overflow-y-auto">
                    {textOnly.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full h-9 px-2 text-left font-body-sm hover:bg-surface-container truncate"
                        onClick={() => {
                          setDmChannel(null);
                          setChatChannelId(c.id);
                          setPickerOpen(false);
                        }}
                      >
                        #{c.name}
                      </button>
                    ))}
                    <div className="border-t border-surface-container-high py-1">
                      <p className="px-2 py-1 font-label-sm text-outline uppercase">DM aç</p>
                      {members
                        .filter((m) => canDm(m.id, m.isBot))
                        .slice(0, 24)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full h-9 px-2 text-left font-body-sm hover:bg-surface-container truncate"
                            onClick={() => openDmWith(m.id)}
                          >
                            {m.displayName}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container"
                aria-label="Sohbeti kapat"
                onClick={() => setChatOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {chatChannel ? (
                <ChatPanel
                  guildId={dmChannel ? (dmChannel.guildId ?? guildId) : guildId}
                  channel={chatChannel}
                  members={members}
                  hideHeader
                  titleOverride={chatTitle}
                />
              ) : (
                <p className="p-4 text-sm text-on-surface-variant">Metin kanalı yok.</p>
              )}
            </div>
          </div>
        ) : null
      }
      participantsPanel={
        participantsOpen ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-surface-container-high px-space-md py-space-sm">
              <p className="font-label-sm uppercase tracking-wide text-outline">Odadakiler</p>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface"
                aria-label="Üyelerinde kapat"
                onClick={() => setParticipantsOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
              {voice.peers.some((p) => p.camera) ? (
                <div className="mb-3 space-y-2 px-2">
                  <p className="font-label-sm uppercase tracking-wide text-outline">Kameralar</p>
                  {voice.peers
                    .filter((p) => p.camera)
                    .map((p) => (
                      <div
                        key={`cam-${p.id}`}
                        className="overflow-hidden rounded-lg bg-black"
                      >
                        <video
                          ref={(el) => voice.attachCamera(p.id, el)}
                          className="aspect-video w-full object-cover"
                          playsInline
                          autoPlay
                          muted
                        />
                        <p className="truncate bg-surface-container-high px-2 py-1 font-label-sm text-on-surface">
                          {p.displayName}
                          {p.id === me ? ' (sen)' : ''}
                        </p>
                      </div>
                    ))}
                </div>
              ) : null}
              <MemberList groups={participantGroups} className="w-full" />
            </div>
          </div>
        ) : undefined
      }
    >
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
            {session.kind === 'billiards' && me && (
              <BilliardsGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'okey' && me && (
              <OkeyGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'bowling' && me && (
              <BowlingGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'tavla' && me && (
              <TavlaGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'blackjack' && me && (
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
            {session.kind === 'trivia' && me && (
              <TriviaGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'words' && me && (
              <WordsGame
                key={session.id}
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
                nameByUserId={nameByUserId}
              />
            )}
            {session.kind === 'watch_party' && me && (
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
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ActivityStageShell>
  );
}
