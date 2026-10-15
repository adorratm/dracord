import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, AppState, LogBox, type AppStateStatus } from 'react-native';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type LocalVideoTrack,
  type RemoteTrack,
} from 'livekit-client';
import {
  AudioSession,
  AndroidAudioTypePresets,
  registerGlobals,
} from '@livekit/react-native';
import type { VoiceTakeoverPayload } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useAuth } from '../../lib/auth';
import {
  startVoiceCallService,
  stopVoiceCallService,
  updateVoiceCallService,
  setupVoiceCallServiceListeners,
} from '../../lib/voiceCallService';

type CameraFacing = 'user' | 'environment';

// Arka plana alınca geçici WebSocket kopmaları LogBox’ı doldurmasın
LogBox.ignoreLogs(['error reading from signal stream', 'ConnectionError']);

let globalsReady = false;
function ensureLiveKit() {
  if (!globalsReady) {
    registerGlobals();
    globalsReady = true;
  }
}

export type VoicePeer = { id: string; name: string; speaking?: boolean };

type VoiceSessionApi = {
  voiceChannelId: string | null;
  voiceGuildId: string | null;
  voiceChannelName: string | null;
  connected: boolean;
  status: string;
  muted: boolean;
  deafened: boolean;
  camOn: boolean;
  screenSharing: boolean;
  cameraFacing: CameraFacing;
  peers: VoicePeer[];
  voiceOnOtherClient: boolean;
  elsewherePlatform: string | null;
  join: (
    guildId: string,
    channel: { id: string; name: string },
    opts?: { reclaim?: boolean },
  ) => Promise<void>;
  leave: () => Promise<void>;
  reclaim: () => Promise<void>;
  setMuted: (v: boolean) => void;
  setDeafened: (v: boolean) => void;
  toggleCamera: () => Promise<void>;
  flipCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
};

const Ctx = createContext<VoiceSessionApi | null>(null);

export function useVoiceSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('VoiceSessionProvider gerekli');
  return v;
}

export function useVoiceSessionOptional() {
  return useContext(Ctx);
}

async function prepareAudioSession() {
  try {
    await AudioSession.configureAudio({
      android: {
        preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
        audioTypeOptions: AndroidAudioTypePresets.communication,
      },
      ios: {
        defaultOutput: 'speaker',
      },
    });
    await AudioSession.startAudioSession();
  } catch {
    /* Expo Go / eksik native */
  }
}

export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const { client, user } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const connectGen = useRef(0);
  const attachedAudio = useRef<ReturnType<RemoteTrack['attach']>[]>([]);
  const channelIdRef = useRef<string | null>(null);
  const guildIdRef = useRef<string | null>(null);
  const channelNameRef = useRef<string | null>(null);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const intentionalLeaveRef = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [voiceGuildId, setVoiceGuildId] = useState<string | null>(null);
  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('');
  const [muted, setMutedState] = useState(false);
  const [deafened, setDeafenedState] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('user');
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [voiceOnOtherClient, setVoiceOnOtherClient] = useState(false);
  const [elsewherePlatform, setElsewherePlatform] = useState<string | null>(null);

  mutedRef.current = muted;
  deafenedRef.current = deafened;
  channelNameRef.current = voiceChannelName;

  const clearAttached = () => {
    for (const el of attachedAudio.current) {
      if (typeof el === 'object' && el && 'pause' in el) {
        (el as HTMLAudioElement).pause?.();
      }
    }
    attachedAudio.current = [];
  };

  const syncCallNotification = useCallback(
    (partial?: {
      connected?: boolean;
      muted?: boolean;
      deafened?: boolean;
      camOn?: boolean;
      screenSharing?: boolean;
      channelName?: string;
    }) => {
      const name = partial?.channelName ?? channelNameRef.current;
      if (!name || !channelIdRef.current) return;
      void updateVoiceCallService({
        channelName: name,
        connected:
          partial?.connected ??
          (!!roomRef.current && roomRef.current.state === ConnectionState.Connected),
        muted: partial?.muted ?? mutedRef.current,
        deafened: partial?.deafened ?? deafenedRef.current,
        camOn: partial?.camOn ?? camOn,
        screenSharing: partial?.screenSharing ?? screenSharing,
      });
    },
    [camOn, screenSharing],
  );

  const disconnectLiveKit = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    clearAttached();
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
    setPeers([]);
    setCamOn(false);
    setScreenSharing(false);
    setCameraFacing('user');
    setConnected(false);
  }, []);

  const refreshPeers = useCallback(
    (room: Room) => {
      const list = Array.from(room.remoteParticipants.values()).map((p) => ({
        id: p.identity,
        name: p.name || p.identity,
        speaking: p.isSpeaking,
      }));
      if (user?.displayName) {
        list.unshift({
          id: 'self',
          name: `${user.displayName} (sen)`,
          speaking: room.localParticipant.isSpeaking,
        });
      }
      setPeers(list);
    },
    [user?.displayName],
  );

  const leave = useCallback(async () => {
    intentionalLeaveRef.current = true;
    connectGen.current += 1;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    const ch = channelIdRef.current;
    channelIdRef.current = null;
    guildIdRef.current = null;
    channelNameRef.current = null;
    setVoiceChannelId(null);
    setVoiceGuildId(null);
    setVoiceChannelName(null);
    setVoiceOnOtherClient(false);
    setElsewherePlatform(null);
    setStatus('');
    await disconnectLiveKit();
    void stopVoiceCallService();
    try {
      await AudioSession.stopAudioSession();
    } catch {
      /* ignore */
    }
    if (ch) {
      try {
        await client.leaveVoiceState(ch);
      } catch {
        /* ignore */
      }
    }
  }, [client, disconnectLiveKit]);

  const join = useCallback(
    async (
      guildId: string,
      channel: { id: string; name: string },
      opts?: { reclaim?: boolean },
    ) => {
      ensureLiveKit();
      intentionalLeaveRef.current = false;

      if (channelIdRef.current === channel.id && roomRef.current && !opts?.reclaim) {
        const state = roomRef.current.state;
        if (state === ConnectionState.Connected || state === ConnectionState.Reconnecting) {
          setVoiceGuildId(guildId);
          guildIdRef.current = guildId;
          setVoiceChannelName(channel.name);
          channelNameRef.current = channel.name;
          setVoiceOnOtherClient(false);
          return;
        }
      }

      const gen = ++connectGen.current;
      const prev = channelIdRef.current;
      if (prev && prev !== channel.id) {
        try {
          await client.leaveVoiceState(prev);
        } catch {
          /* ignore */
        }
      }
      await disconnectLiveKit();

      await prepareAudioSession();
      void startVoiceCallService({
        channelName: channel.name,
        connected: false,
        muted: mutedRef.current,
        deafened: deafenedRef.current,
      });

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        reconnectPolicy: {
          nextRetryDelayInMs: (context) => {
            // En fazla ~30 sn aralıkla yeniden dene; arka planda kopunca toparlansın
            if (context.retryCount > 20) return null;
            return Math.min(1000 * 2 ** Math.min(context.retryCount, 4), 30_000);
          },
        },
      });
      roomRef.current = room;
      channelIdRef.current = channel.id;
      guildIdRef.current = guildId;
      channelNameRef.current = channel.name;
      setVoiceChannelId(channel.id);
      setVoiceGuildId(guildId);
      setVoiceChannelName(channel.name);
      setStatus('Bağlanıyor…');
      setVoiceOnOtherClient(false);
      setElsewherePlatform(null);

      const onTrackSubscribed = (track: RemoteTrack, pub: { kind?: Track.Kind }) => {
        if (pub.kind === Track.Kind.Audio) {
          const el = track.attach();
          if (typeof el === 'object' && el && 'muted' in el) {
            (el as HTMLAudioElement).muted = deafenedRef.current;
          }
          attachedAudio.current.push(el);
        }
        refreshPeers(room);
      };

      room.on(RoomEvent.ParticipantConnected, () => refreshPeers(room));
      room.on(RoomEvent.ParticipantDisconnected, () => refreshPeers(room));
      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.ActiveSpeakersChanged, () => refreshPeers(room));
      room.on(RoomEvent.Reconnecting, () => {
        setConnected(false);
        setStatus('Yeniden bağlanılıyor…');
        void updateVoiceCallService({
          channelName: channelNameRef.current ?? channel.name,
          connected: false,
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
      });
      room.on(RoomEvent.Reconnected, () => {
        setConnected(true);
        setStatus('Bağlı');
        void updateVoiceCallService({
          channelName: channelNameRef.current ?? channel.name,
          connected: true,
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
      });
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        if (intentionalLeaveRef.current) return;
        if (!channelIdRef.current) return;
        setStatus('Yeniden bağlanılıyor…');
        void updateVoiceCallService({
          channelName: channelNameRef.current ?? 'Ses',
          connected: false,
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
      });

      try {
        if (opts?.reclaim) {
          await client.claimVoiceClient(channel.id).catch(() => undefined);
        } else {
          await client.joinVoiceState(channel.id, {
            muted: mutedRef.current,
            deafened: deafenedRef.current,
          });
        }
        const tok = await client.getVoiceToken(channel.id);
        if (gen !== connectGen.current) return;
        await room.connect(tok.url, tok.token);
        await room.localParticipant.setMicrophoneEnabled(
          !mutedRef.current && !deafenedRef.current,
        );
        setConnected(true);
        setStatus('Bağlı');
        refreshPeers(room);
        void startVoiceCallService({
          channelName: channel.name,
          connected: true,
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
      } catch (e) {
        if (gen !== connectGen.current) return;
        setStatus(e instanceof Error ? e.message : 'Ses bağlantısı başarısız');
        channelIdRef.current = null;
        guildIdRef.current = null;
        channelNameRef.current = null;
        setVoiceChannelId(null);
        setVoiceGuildId(null);
        setVoiceChannelName(null);
        await disconnectLiveKit();
        void stopVoiceCallService();
      }
    },
    [client, disconnectLiveKit, refreshPeers],
  );

  const reclaim = useCallback(async () => {
    const ch = channelIdRef.current;
    const gid = guildIdRef.current;
    const name = voiceChannelName;
    if (!ch || !gid) return;
    await join(gid, { id: ch, name: name ?? 'Ses' }, { reclaim: true });
  }, [join, voiceChannelName]);

  const setMuted = useCallback(
    (v: boolean) => {
      setMutedState(v);
      mutedRef.current = v;
      void roomRef.current?.localParticipant.setMicrophoneEnabled(!v && !deafenedRef.current);
      const ch = channelIdRef.current;
      if (ch) void client.updateVoiceState(ch, { muted: v }).catch(() => undefined);
      syncCallNotification({ muted: v });
    },
    [client, syncCallNotification],
  );

  const setDeafened = useCallback(
    (v: boolean) => {
      setDeafenedState(v);
      deafenedRef.current = v;
      for (const el of attachedAudio.current) {
        if (typeof el === 'object' && el && 'muted' in el) {
          (el as HTMLAudioElement).muted = v;
        }
      }
      if (v) {
        setMutedState(true);
        mutedRef.current = true;
        void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
      }
      const ch = channelIdRef.current;
      if (ch) {
        void client
          .updateVoiceState(ch, { deafened: v, muted: v ? true : mutedRef.current })
          .catch(() => undefined);
      }
      syncCallNotification({ deafened: v, muted: v ? true : mutedRef.current });
    },
    [client, syncCallNotification],
  );

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    try {
      if (next) {
        await room.localParticipant.setCameraEnabled(true, { facingMode: cameraFacing });
        setCamOn(true);
        syncCallNotification({ camOn: true });
      } else {
        await room.localParticipant.setCameraEnabled(false);
        setCamOn(false);
        syncCallNotification({ camOn: false });
      }
    } catch (e) {
      setCamOn(false);
      Alert.alert('Kamera', e instanceof Error ? e.message : 'Kamera açılamadı');
    }
  }, [camOn, cameraFacing, syncCallNotification]);

  const flipCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next: CameraFacing = cameraFacing === 'user' ? 'environment' : 'user';
    try {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track as LocalVideoTrack | undefined;
      if (camOn && track && typeof track.restartTrack === 'function') {
        await track.restartTrack({ facingMode: next });
      } else {
        await room.localParticipant.setCameraEnabled(true, { facingMode: next });
        setCamOn(true);
      }
      setCameraFacing(next);
    } catch (e) {
      Alert.alert('Kamera', e instanceof Error ? e.message : 'Kamera döndürülemedi');
    }
  }, [cameraFacing, camOn]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenSharing;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenSharing(next);
      syncCallNotification({ screenSharing: next });
    } catch (e) {
      setScreenSharing(false);
      Alert.alert(
        'Ekran paylaşımı',
        e instanceof Error
          ? e.message
          : 'Ekran paylaşımı bu cihazda kullanılamıyor. Geliştirme derlemesi (dev client) gerekir.',
      );
    }
  }, [screenSharing, syncCallNotification]);

  // Bildirim / ada butonları
  useEffect(() => {
    return setupVoiceCallServiceListeners({
      onMuteToggle: () => {
        setMuted(!mutedRef.current);
      },
      onLeave: () => {
        void leave();
      },
    });
  }, [leave, setMuted]);

  // Arka plan: FGS/bildirim + audio session canlı kalsın; öne gelince kopuksa reconnect
  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      const ch = channelIdRef.current;
      const gid = guildIdRef.current;
      const name = channelNameRef.current;
      if (!ch || !gid || intentionalLeaveRef.current) return;

      if (next === 'background' || next === 'inactive') {
        void prepareAudioSession();
        void startVoiceCallService({
          channelName: name ?? 'Ses',
          connected: roomRef.current?.state === ConnectionState.Connected,
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
        return;
      }

      if (next !== 'active') return;

      const room = roomRef.current;
      if (room && room.state === ConnectionState.Connected) {
        void prepareAudioSession();
        syncCallNotification({ connected: true });
        return;
      }

      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        if (!channelIdRef.current || intentionalLeaveRef.current) return;
        void join(gid, { id: ch, name: name ?? 'Ses' });
      }, 400);
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [join, syncCallNotification]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onTakeover = (payload: VoiceTakeoverPayload) => {
      if (payload.clientId === client.getVoiceClientId()) return;
      if (!channelIdRef.current) return;
      void (async () => {
        intentionalLeaveRef.current = true;
        await disconnectLiveKit();
        void stopVoiceCallService();
        setVoiceOnOtherClient(true);
        setElsewherePlatform(payload.platform ?? null);
        setStatus(
          payload.platform === 'desktop'
            ? 'Ses masaüstünde'
            : payload.platform === 'web'
              ? 'Ses webde'
              : 'Ses başka cihazda',
        );
      })();
    };
    sock.on(SocketEvents.VOICE_TAKEOVER, onTakeover);
    return () => {
      sock.off(SocketEvents.VOICE_TAKEOVER, onTakeover);
    };
  }, [user, client, disconnectLiveKit]);

  // Heartbeat — aktif istemci kontrolü
  useEffect(() => {
    if (!voiceChannelId || !connected) return;
    const id = setInterval(() => {
      void client
        .voiceHeartbeat(voiceChannelId)
        .then((r) => {
          if (r && 'active' in r && r.active === false) {
            intentionalLeaveRef.current = true;
            void disconnectLiveKit().then(() => {
              void stopVoiceCallService();
              setVoiceOnOtherClient(true);
              setStatus('Ses başka cihazda');
            });
          }
        })
        .catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, [voiceChannelId, connected, client, disconnectLiveKit]);

  const value = useMemo<VoiceSessionApi>(
    () => ({
      voiceChannelId,
      voiceGuildId,
      voiceChannelName,
      connected,
      status,
      muted,
      deafened,
      camOn,
      screenSharing,
      cameraFacing,
      peers,
      voiceOnOtherClient,
      elsewherePlatform,
      join,
      leave,
      reclaim,
      setMuted,
      setDeafened,
      toggleCamera,
      flipCamera,
      toggleScreenShare,
    }),
    [
      voiceChannelId,
      voiceGuildId,
      voiceChannelName,
      connected,
      status,
      muted,
      deafened,
      camOn,
      screenSharing,
      cameraFacing,
      peers,
      voiceOnOtherClient,
      elsewherePlatform,
      join,
      leave,
      reclaim,
      setMuted,
      setDeafened,
      toggleCamera,
      flipCamera,
      toggleScreenShare,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
