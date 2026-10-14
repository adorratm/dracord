import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client';
import type { ChannelSummary, PublicUser } from '@dracord/types';
import { MemberList, VoiceStage, type MemberListGroup, type VoiceParticipant } from '@dracord/ui';
import { useAuth } from '../auth';
import { ChatPanel } from './ChatPanel';

export function VoicePanel({
  guildId,
  channel,
  members = [],
  textChannels = [],
  muted: mutedProp,
  deafened: deafenedProp,
  onMutedChange,
  onDeafenedChange,
}: {
  guildId: string;
  channel: ChannelSummary;
  members?: PublicUser[];
  textChannels?: ChannelSummary[];
  muted?: boolean;
  deafened?: boolean;
  onMutedChange?: (v: boolean) => void;
  onDeafenedChange?: (v: boolean) => void;
}) {
  const { client, user } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const attached = useRef<HTMLMediaElement[]>([]);
  const cameraEls = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenEls = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [muted, setMuted] = useState(mutedProp ?? false);
  const [deafened, setDeafened] = useState(deafenedProp ?? false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(340);
  const [partsWidth, setPartsWidth] = useState(288);
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [chatChannelId, setChatChannelId] = useState<string | null>(
    () => textChannels.find((c) => c.type === 'TEXT')?.id ?? null,
  );
  const [peers, setPeers] = useState<VoiceParticipant[]>([]);
  const [screenShares, setScreenShares] = useState<
    Array<{ identity: string; displayName: string; isLocal?: boolean }>
  >([]);
  const [focusedShare, setFocusedShare] = useState<string | null>(null);
  const userId = user?.id;
  const displayName = user?.displayName;

  const chatChannel =
    textChannels.find((c) => c.id === chatChannelId) ??
    textChannels.find((c) => c.type === 'TEXT') ??
    null;

  const participantGroups: MemberListGroup[] = useMemo(() => {
    const inVoice = peers.map((p) => {
      const m = members.find((x) => x.id === p.id);
      return {
        id: p.id,
        displayName: p.displayName,
        username: m?.username,
        avatarUrl: p.avatarUrl ?? m?.avatarUrl,
        status: (m?.status ?? 'ONLINE') as 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE',
        customStatus: m?.customStatus,
        isBot: Boolean(m?.isBot),
        subtitle: p.speaking ? 'Konuşuyor' : p.muted ? 'Sessiz' : 'Seste',
      };
    });
    const groups: MemberListGroup[] = [];
    if (inVoice.length) {
      groups.push({ id: 'voice', label: `Sestekiler — ${inVoice.length}`, members: inVoice });
    }
    const offlineish = members
      .filter((m) => !peers.some((p) => p.id === m.id))
      .slice(0, 40)
      .map((m) => ({
        id: m.id,
        displayName: m.displayName,
        username: m.username,
        avatarUrl: m.avatarUrl,
        status: (m.status ?? 'OFFLINE') as 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE',
        customStatus: m.customStatus,
        isBot: Boolean(m.isBot),
      }));
    if (offlineish.length) {
      groups.push({
        id: 'members',
        label: `Üyeler — ${offlineish.length}`,
        members: offlineish,
      });
    }
    return groups;
  }, [peers, members]);

  useEffect(() => {
    if (mutedProp !== undefined) setMuted(mutedProp);
  }, [mutedProp]);
  useEffect(() => {
    if (deafenedProp !== undefined) setDeafened(deafenedProp);
  }, [deafenedProp]);

  useEffect(() => {
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    const refresh = () => {
      const list: VoiceParticipant[] = [];
      if (displayName && userId) {
        list.push({
          id: userId,
          displayName: `${displayName} (sen)`,
          avatarUrl: user?.avatarUrl,
          speaking: room.localParticipant.isSpeaking,
          muted,
          camera: camOn,
          video: screenOn,
        });
      }
      for (const p of room.remoteParticipants.values()) {
        const cams = Array.from(p.trackPublications.values()).some(
          (pub) => pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera && pub.isSubscribed,
        );
        const screens = Array.from(p.trackPublications.values()).some(
          (pub) =>
            pub.kind === Track.Kind.Video &&
            pub.source === Track.Source.ScreenShare &&
            pub.isSubscribed,
        );
        list.push({
          id: p.identity,
          displayName: p.name || p.identity,
          speaking: p.isSpeaking,
          muted: p.isMicrophoneEnabled === false,
          camera: cams,
          video: screens,
        });
      }
      setPeers(list);

      const shares: Array<{ identity: string; displayName: string; isLocal?: boolean }> = [];
      if (screenOn && userId) {
        shares.push({ identity: userId, displayName: displayName ?? 'Sen', isLocal: true });
      }
      for (const p of room.remoteParticipants.values()) {
        const has = Array.from(p.trackPublications.values()).some(
          (pub) => pub.source === Track.Source.ScreenShare && pub.track,
        );
        if (has) shares.push({ identity: p.identity, displayName: p.name || p.identity });
      }
      setScreenShares(shares);
      if (shares.length && !focusedShare) setFocusedShare(shares[0].identity);
    };

    const attachRemote = (
      track: RemoteTrack,
      pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (pub.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.dataset.peer = participant.identity;
        document.body.appendChild(el);
        attached.current.push(el);
        if (deafened) el.muted = true;
      }
      if (pub.kind === Track.Kind.Video) {
        const map =
          pub.source === Track.Source.ScreenShare ? screenEls.current : cameraEls.current;
        const el = map.get(participant.identity);
        if (el) track.attach(el);
      }
      refresh();
    };

    room.on(RoomEvent.ParticipantConnected, refresh);
    room.on(RoomEvent.ParticipantDisconnected, refresh);
    room.on(RoomEvent.TrackSubscribed, attachRemote);
    room.on(RoomEvent.TrackUnsubscribed, refresh);
    room.on(RoomEvent.ActiveSpeakersChanged, refresh);
    room.on(RoomEvent.LocalTrackPublished, refresh);
    room.on(RoomEvent.LocalTrackUnpublished, refresh);

    void (async () => {
      try {
        await client.joinVoiceState(channel.id, { muted, deafened });
        const tok = await client.getVoiceToken(channel.id);
        if (cancelled) return;
        await room.connect(tok.url, tok.token);
        await room.localParticipant.setMicrophoneEnabled(!muted);
        setConnected(true);
        setStatus(null);
        refresh();
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : 'Ses bağlantısı başarısız');
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      for (const el of attached.current) {
        el.pause();
        el.srcObject = null;
        el.remove();
      }
      attached.current = [];
      void room.disconnect();
      void client.leaveVoiceState(channel.id);
      roomRef.current = null;
    };
  }, [client, channel.id, userId, displayName]);

  useEffect(() => {
    for (const el of attached.current) el.muted = deafened;
  }, [deafened]);

  const setMute = (next: boolean) => {
    setMuted(next);
    onMutedChange?.(next);
    void roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
    void client.updateVoiceState(channel.id, { muted: next, deafened });
  };

  const setDeafen = (next: boolean) => {
    setDeafened(next);
    onDeafenedChange?.(next);
    if (next) {
      setMuted(true);
      onMutedChange?.(true);
      void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
    }
    void client.updateVoiceState(channel.id, { muted: next || muted, deafened: next });
  };

  const focused = screenShares.find((s) => s.identity === focusedShare) ?? screenShares[0];

  return (
    <VoiceStage
      className="h-full"
      channelName={channel.name}
      participants={peers}
      localParticipantId={userId}
      rtcConnected={connected}
      muted={muted}
      deafened={deafened}
      cameraEnabled={camOn}
      screenSharing={screenOn}
      screenShares={screenShares}
      screenShare={
        focused
          ? {
              identity: focused.identity,
              displayName: focused.displayName,
              isLocal: focused.isLocal,
              videoRef: (el) => {
                if (!el || !focused) return;
                screenEls.current.set(focused.identity, el);
                const room = roomRef.current;
                if (!room) return;
                if (focused.isLocal) {
                  const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
                  pub?.track?.attach(el);
                } else {
                  const p = room.remoteParticipants.get(focused.identity);
                  const pub = p
                    ? Array.from(p.trackPublications.values()).find(
                        (x) => x.source === Track.Source.ScreenShare,
                      )
                    : undefined;
                  pub?.track?.attach(el);
                }
              },
            }
          : null
      }
      onFocusScreenShare={(id) => setFocusedShare(id)}
      onCameraVideoRef={(participantId, el) => {
        if (!el) {
          cameraEls.current.delete(participantId);
          return;
        }
        cameraEls.current.set(participantId, el);
        const room = roomRef.current;
        if (!room) return;
        if (participantId === userId) {
          const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          pub?.track?.attach(el);
        } else {
          const p = room.remoteParticipants.get(participantId);
          const pub = p
            ? Array.from(p.trackPublications.values()).find((x) => x.source === Track.Source.Camera)
            : undefined;
          pub?.track?.attach(el);
        }
      }}
      chatDrawerOpen={chatOpen}
      participantsDrawerOpen={participantsOpen}
      chatPanelWidth={chatWidth}
      onChatPanelWidthChange={setChatWidth}
      participantsPanelWidth={partsWidth}
      onParticipantsPanelWidthChange={setPartsWidth}
      onToggleMute={() => setMute(!muted)}
      onToggleDeafen={() => setDeafen(!deafened)}
      onToggleCamera={() => {
        const next = !camOn;
        setCamOn(next);
        void roomRef.current?.localParticipant.setCameraEnabled(next);
      }}
      onToggleScreenShare={() => {
        void (async () => {
          const room = roomRef.current;
          if (!room) return;
          if (screenOn) {
            await room.localParticipant.setScreenShareEnabled(false);
            setScreenOn(false);
            void client.updateVoiceState(channel.id, { screenSharing: false });
            return;
          }
          try {
            await room.localParticipant.setScreenShareEnabled(true);
            setScreenOn(true);
            void client.updateVoiceState(channel.id, { screenSharing: true });
          } catch (e) {
            setStatus(e instanceof Error ? e.message : 'Ekran paylaşımı başarısız');
          }
        })();
      }}
      onToggleChat={() => setChatOpen((v) => !v)}
      onToggleParticipants={() => setParticipantsOpen((v) => !v)}
      onLeave={() => {
        void roomRef.current?.disconnect();
        void client.leaveVoiceState(channel.id);
      }}
      stageOverlay={
        status ? (
          <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-lg bg-error-container text-on-error-container text-sm">
              {status}
            </div>
          </div>
        ) : null
      }
      chatPanel={
        chatOpen ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-surface-container-high px-2">
              {textChannels.filter((c) => c.type === 'TEXT').length > 1 ? (
                <select
                  className="h-8 min-w-0 flex-1 rounded-lg bg-surface-container-highest px-2 text-sm outline-none"
                  value={chatChannel?.id ?? ''}
                  onChange={(e) => setChatChannelId(e.target.value)}
                >
                  {textChannels
                    .filter((c) => c.type === 'TEXT')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="min-w-0 flex-1 truncate font-body-sm text-on-surface">
                  {chatChannel ? `#${chatChannel.name}` : 'Sohbet'}
                </span>
              )}
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface"
                aria-label="Sohbeti kapat"
                onClick={() => setChatOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {chatChannel ? (
                <ChatPanel guildId={guildId} channel={chatChannel} />
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
              <p className="font-label-sm uppercase tracking-wide text-outline">Sestekiler</p>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface"
                aria-label="Üyeleri kapat"
                onClick={() => setParticipantsOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
              <MemberList groups={participantGroups} className="w-full" />
            </div>
          </div>
        ) : undefined
      }
    />
  );
}
