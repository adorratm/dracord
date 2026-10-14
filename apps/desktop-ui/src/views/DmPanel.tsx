import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import type { ChannelSummary } from '@dracord/types';
import { useAuth } from '../auth';
import { ChatPanel } from './ChatPanel';

export function DmPanel() {
  const { client } = useAuth();
  const [dms, setDms] = useState<ChannelSummary[]>([]);
  const [active, setActive] = useState<ChannelSummary | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const attached = useRef<HTMLMediaElement[]>([]);

  const reload = () =>
    client.listDms().then((list) => {
      setDms(list);
      setActive((cur) => cur ?? list[0] ?? null);
    });

  useEffect(() => {
    void reload();
  }, [client]);

  useEffect(() => {
    return () => {
      void endCall();
    };
  }, []);

  const endCall = async () => {
    const room = roomRef.current;
    roomRef.current = null;
    for (const el of attached.current) {
      el.pause();
      el.srcObject = null;
      el.remove();
    }
    attached.current = [];
    if (room) await room.disconnect();
    if (active) {
      try {
        await client.declineDmCall(active.id);
      } catch {
        /* ignore */
      }
    }
    setCallStatus(null);
  };

  const startCall = async (mode: 'audio' | 'video') => {
    if (!active) return;
    setCallStatus('Aranıyor…');
    try {
      await client.startDmCall(active.id, mode);
      const tok = await client.getVoiceToken(active.id);
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub) => {
        if (pub.kind === Track.Kind.Audio) {
          const el = track.attach();
          document.body.appendChild(el);
          attached.current.push(el);
        }
      });
      await room.connect(tok.url, tok.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (mode === 'video') await room.localParticipant.setCameraEnabled(true);
      setCallStatus(mode === 'video' ? 'Görüntülü arama' : 'Sesli arama');
    } catch (e) {
      setCallStatus(e instanceof Error ? e.message : 'Arama başarısız');
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-60 shrink-0 border-r border-outline-variant p-2 overflow-auto bg-surface-container-low">
        <div className="font-bold px-2 py-2">Direkt mesajlar</div>
        {dms.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              void endCall();
              setActive(c);
            }}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
              active?.id === c.id
                ? 'bg-surface-container-high text-on-surface font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            {c.name || c.peerUserId || 'DM'}
          </button>
        ))}
        {dms.length === 0 && (
          <p className="text-on-surface-variant px-2 text-sm">
            Henüz DM yok. Arkadaşlar üzerinden aç.
          </p>
        )}
      </aside>
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {active ? (
          <>
            <div className="h-11 border-b border-outline-variant flex items-center gap-2 px-3 shrink-0">
              <strong className="flex-1 truncate">{active.name || 'DM'}</strong>
              {callStatus && (
                <span className="text-xs text-on-surface-variant">{callStatus}</span>
              )}
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest"
                onClick={() => void startCall('audio')}
                title="Sesli ara"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest"
                onClick={() => void startCall('video')}
                title="Görüntülü ara"
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span>
              </button>
              {callStatus && (
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg bg-error-container text-on-error-container text-sm font-bold"
                  onClick={() => void endCall()}
                >
                  Bitir
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel guildId="" channel={active} />
            </div>
          </>
        ) : (
          <div className="p-6 text-on-surface-variant">Bir DM seç</div>
        )}
      </div>
    </div>
  );
}
