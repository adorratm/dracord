'use client';

import { useCallback, useEffect, useState } from 'react';
import { DM_CALL_GUILD_ID, SocketEvents, type DmCallPayload } from '@dracord/types';
import { Modal } from '@dracord/ui';
import { useAuth } from '@/components/AuthProvider';
import { useVoiceSession } from '@/components/VoiceSessionProvider';

type FriendRow = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

export function DmCallControls({
  channelId,
  selfNotes,
  friends,
  peerStatus,
}: {
  channelId: string;
  selfNotes?: boolean;
  friends: FriendRow[];
  peerStatus?: string | null;
}) {
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const inThisCall =
    voice.voiceChannelId === channelId && voice.voiceGuildId === DM_CALL_GUILD_ID;
  const inGuildVoice =
    Boolean(voice.voiceChannelId) && voice.voiceGuildId !== DM_CALL_GUILD_ID;
  const peerOffline = peerStatus === 'OFFLINE';
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<
    Array<{ id: string; displayName: string; avatarUrl?: string | null }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageExpanded, setStageExpanded] = useState(true);

  const refreshMembers = useCallback(async () => {
    try {
      const list = await client.listDmMembers(channelId);
      setMembers(
        list.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
        })),
      );
    } catch {
      setMembers([]);
    }
  }, [client, channelId]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  useEffect(() => {
    if (inThisCall) setStageExpanded(true);
  }, [inThisCall]);

  const start = async (mode: 'audio' | 'video') => {
    if (selfNotes) return;
    if (peerOffline) {
      setError('Karşı taraf çevrimdışı — arama yapılamaz');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (inGuildVoice || (voice.voiceChannelId && voice.voiceChannelId !== channelId)) {
        voice.leave();
        await new Promise((r) => window.setTimeout(r, 250));
      }
      await client.startDmCall(channelId, mode);
      voice.join(channelId, DM_CALL_GUILD_ID);
      if (mode === 'video') {
        window.setTimeout(() => {
          void voice.toggleCamera().catch(() => undefined);
        }, 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Arama başlatılamadı');
    } finally {
      setBusy(false);
    }
  };

  const hangUp = () => {
    voice.leave();
  };

  const invite = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      await client.inviteToDmCall(channelId, userId);
      await refreshMembers();
      setInviteOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Davet gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  const removeParticipant = async (userId: string) => {
    setBusy(true);
    try {
      await client.removeFromDmCall(channelId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Çıkarılamadı');
    } finally {
      setBusy(false);
    }
  };

  if (selfNotes) return null;

  const gridCols =
    voice.participants.length <= 1
      ? 'grid-cols-1'
      : voice.participants.length <= 4
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <>
      <div className="flex items-center gap-1">
        {!inThisCall ? (
          <>
            <button
              type="button"
              disabled={busy || peerOffline}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container disabled:opacity-50"
              aria-label="Sesli ara"
              title={peerOffline ? 'Çevrimdışı' : 'Sesli ara'}
              onClick={() => void start('audio')}
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
            </button>
            <button
              type="button"
              disabled={busy || peerOffline}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container disabled:opacity-50"
              aria-label="Görüntülü ara"
              title={peerOffline ? 'Çevrimdışı' : 'Görüntülü ara'}
              onClick={() => void start('video')}
            >
              <span className="material-symbols-outlined text-[18px]">videocam</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
              aria-label="Mikrofon"
              onClick={() => void voice.toggleMute()}
            >
              <span className="material-symbols-outlined text-[18px]">
                {voice.muted ? 'mic_off' : 'mic'}
              </span>
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
              aria-label="Kamera"
              onClick={() => void voice.toggleCamera()}
            >
              <span className="material-symbols-outlined text-[18px]">
                {voice.cameraEnabled ? 'videocam' : 'videocam_off'}
              </span>
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
              aria-label={voice.screenSharing ? 'Paylaşımı durdur' : 'Ekran paylaş'}
              title={voice.screenSharing ? 'Paylaşımı durdur' : 'Ekran paylaş'}
              onClick={() => void voice.toggleScreenShare()}
            >
              <span className="material-symbols-outlined text-[18px]">
                {voice.screenSharing ? 'stop_screen_share' : 'present_to_all'}
              </span>
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
              aria-label="Sahneyi aç/kapat"
              title="Görüntü sahnesi"
              onClick={() => setStageExpanded((v) => !v)}
            >
              <span className="material-symbols-outlined text-[18px]">
                {stageExpanded ? 'unfold_less' : 'grid_view'}
              </span>
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
              aria-label="Kişi ekle"
              title="Kişi ekle"
              onClick={() => {
                void refreshMembers();
                setInviteOpen(true);
              }}
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
            </button>
            <button
              type="button"
              className="h-8 px-2 rounded-lg flex items-center justify-center text-error hover:bg-error/10 font-label-sm"
              onClick={hangUp}
            >
              Kapat
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="absolute top-12 right-4 z-20 max-w-xs rounded-lg bg-error/15 px-3 py-2 font-body-sm text-error">
          {error}
        </p>
      )}

      {inThisCall && stageExpanded && (
        <div className="absolute left-0 right-0 top-12 z-10 border-b border-surface-container-high bg-surface-container-lowest/95 backdrop-blur-sm px-space-md py-space-sm space-y-space-sm">
          {voice.activeScreenShare && (
            <div className="relative w-full aspect-video max-h-[40vh] rounded-xl overflow-hidden bg-black">
              <video
                className="absolute inset-0 h-full w-full object-contain"
                autoPlay
                playsInline
                muted={voice.activeScreenShare.isLocal}
                ref={(el) => voice.setScreenVideoElement(el)}
              />
              <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 font-label-sm text-white">
                {voice.activeScreenShare.displayName} · ekran
              </div>
              {voice.availableScreenShares.length > 1 && (
                <div className="absolute top-2 right-2 flex gap-1">
                  {voice.availableScreenShares.map((s) => (
                    <button
                      key={s.identity}
                      type="button"
                      className={`rounded-md px-2 py-0.5 font-label-sm ${
                        voice.activeScreenShare?.identity === s.identity
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-black/50 text-white'
                      }`}
                      onClick={() => voice.focusScreenShare(s.identity)}
                    >
                      {s.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={`grid ${gridCols} gap-2`}>
            {voice.participants.map((p) => (
              <div
                key={p.id}
                className={`relative aspect-video min-h-[7rem] rounded-xl overflow-hidden bg-surface-container-highest ${
                  p.speaking ? 'ring-2 ring-primary' : ''
                }`}
              >
                {p.camera ? (
                  <video
                    className="absolute inset-0 h-full w-full object-cover"
                    autoPlay
                    playsInline
                    muted={p.id === user?.id}
                    ref={(el) => voice.setCameraVideoElement(p.id, el)}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatarUrl}
                        alt=""
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[40px] text-outline">
                        person
                      </span>
                    )}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <span className="font-label-sm text-white truncate">
                    {p.displayName}
                    {p.muted ? ' · sessiz' : ''}
                    {p.video ? ' · paylaşım' : ''}
                  </span>
                  {p.id !== user?.id && (
                    <button
                      type="button"
                      className="shrink-0 font-label-sm text-error hover:underline"
                      onClick={() => void removeParticipant(p.id)}
                    >
                      Çıkar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={inviteOpen} title="Aramaya kişi ekle" onClose={() => setInviteOpen(false)}>
        <p className="font-body-sm text-outline mb-space-sm">
          Arkadaşını gruba ekler ve arama daveti gönderir.
        </p>
        <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {friends
            .filter((f) => !members.some((m) => m.id === f.id) && f.id !== user?.id)
            .map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="w-full text-left rounded-lg px-space-sm py-space-sm hover:bg-surface-container-high disabled:opacity-50"
                  onClick={() => void invite(f.id)}
                >
                  <span className="font-label-sm text-on-surface">{f.displayName}</span>
                  <span className="block font-body-sm text-outline">@{f.username}</span>
                </button>
              </li>
            ))}
          <p className="font-label-sm text-outline mt-2">
            Çevrimdışı kullanıcıya davet sunucu tarafından reddedilir.
          </p>
          {friends.filter((f) => !members.some((m) => m.id === f.id) && f.id !== user?.id)
            .length === 0 && (
            <li className="font-body-sm text-outline">Eklenecek arkadaş yok.</li>
          )}
        </ul>
      </Modal>
    </>
  );
}

/** Gelen DM araması bildirimi (AppShell veya layout) */
export function DmIncomingCallListener() {
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const [incoming, setIncoming] = useState<DmCallPayload | null>(null);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onCall = (payload: DmCallPayload) => {
      if (payload.fromUserId === user.id) return;
      if (payload.action === 'ring' || payload.action === 'invite') {
        setIncoming(payload);
        return;
      }
      if (
        payload.action === 'ended' ||
        payload.action === 'decline' ||
        payload.action === 'leave'
      ) {
        setIncoming((prev) =>
          prev && prev.channelId === payload.channelId ? null : prev,
        );
      }
    };
    sock.on(SocketEvents.DM_CALL, onCall);
    return () => {
      sock.off(SocketEvents.DM_CALL, onCall);
    };
  }, [client, user]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onCall = (payload: DmCallPayload) => {
      if (payload.action !== 'leave') return;
      if (payload.targetUserId !== user.id) return;
      if (voice.voiceChannelId === payload.channelId) voice.leave();
    };
    sock.on(SocketEvents.DM_CALL, onCall);
    return () => {
      sock.off(SocketEvents.DM_CALL, onCall);
    };
  }, [client, user, voice]);

  if (!incoming) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[300] w-80 rounded-2xl bg-surface-container-high shadow-lg border border-surface-container p-space-md space-y-space-sm">
      <p className="font-title-sm text-on-surface">
        {incoming.mode === 'video' ? 'Görüntülü arama' : 'Sesli arama'}
      </p>
      <p className="font-body-sm text-on-surface-variant">
        {incoming.fromDisplayName ?? 'Birisi'} seni arıyor…
      </p>
      <div className="flex gap-space-sm">
        <button
          type="button"
          className="flex-1 h-10 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
          onClick={() => {
            const ch = incoming.channelId;
            const mode = incoming.mode;
            setIncoming(null);
            if (
              voice.voiceChannelId &&
              voice.voiceGuildId &&
              voice.voiceGuildId !== DM_CALL_GUILD_ID
            ) {
              voice.leave();
            }
            window.setTimeout(() => {
              voice.join(ch, DM_CALL_GUILD_ID);
              if (mode === 'video') {
                window.setTimeout(() => {
                  void voice.toggleCamera().catch(() => undefined);
                }, 1200);
              }
            }, 200);
          }}
        >
          Kabul et
        </button>
        <button
          type="button"
          className="flex-1 h-10 rounded-lg bg-error/15 text-error font-label-sm"
          onClick={() => {
            void client.declineDmCall(incoming.channelId).catch(() => undefined);
            setIncoming(null);
          }}
        >
          Reddet
        </button>
      </div>
    </div>
  );
}
