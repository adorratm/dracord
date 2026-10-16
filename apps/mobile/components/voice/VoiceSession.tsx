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
import { playUiTone } from '../../lib/sounds';

type CameraFacing = 'user' | 'environment';

// LiveKit kopma / arka plan uyarıları LogBox’ı doldurmasın (zararsız)
LogBox.ignoreLogs([
  'error reading from signal stream',
  'ConnectionError',
  'closed unexpectedly',
  'DATA_TRACK_LOSSY',
  'publisher data channel',
  "right operand of 'in' is not an object",
]);

/**
 * RN AbortController polyfill çoğu zaman abort(reason) yok sayar → reason undefined.
 * LiveKit `getAbortReasonAsString` içinde `'toString' in reason` TypeError atar.
 */
function patchAbortControllerForLiveKit() {
  try {
    const g = globalThis as typeof globalThis & {
      AbortController?: typeof AbortController;
      __dracordAbortPatched?: boolean;
    };
    if (g.__dracordAbortPatched || !g.AbortController) return;
    const proto = g.AbortController.prototype;
    const orig = proto.abort;
    proto.abort = function abort(this: AbortController, reason?: unknown) {
      // Her zaman object — LiveKit `'x' in reason` için null/string kırılır
      const safe =
        reason !== undefined &&
        reason !== null &&
        typeof reason === 'object'
          ? reason
          : new Error(
              typeof reason === 'string' && reason
                ? reason
                : 'Aborted',
            );
      return orig.call(this, safe);
    };
    g.__dracordAbortPatched = true;
  } catch {
    /* ignore */
  }
}

let globalsReady = false;
function ensureLiveKit() {
  if (!globalsReady) {
    patchAbortControllerForLiveKit();
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
  /** Bağlı kanal tipi — AFK zamanlayıcı GAME/WATCH_PARTY’de çalışmaz */
  voiceChannelType: string | null;
  join: (
    guildId: string,
    channel: { id: string; name: string; type?: string },
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
  const channelTypeRef = useRef<string | null>(null);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const intentionalLeaveRef = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afkSilenceRef = useRef(false);
  const lastSpokeAtRef = useRef(Date.now());
  const afkMovingRef = useRef(false);
  const afkVoiceChannelTrackedRef = useRef<string | null>(null);
  const selfSpeakingRef = useRef(false);
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [voiceGuildId, setVoiceGuildId] = useState<string | null>(null);
  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null);
  const [voiceChannelType, setVoiceChannelType] = useState<string | null>(null);
  const [afkChannelId, setAfkChannelId] = useState<string | null>(null);
  const [afkTimeoutMinutes, setAfkTimeoutMinutes] = useState(0);
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
        /* RN AbortController + LiveKit abort reason yarışı */
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
      // Gerçek user id — 'self' ayrı satır üretir (API üyesi + (sen) çifti)
      if (user?.id) {
        list.unshift({
          id: user.id,
          name: user.displayName || user.id,
          speaking: room.localParticipant.isSpeaking,
        });
      }
      setPeers(list);
    },
    [user?.id, user?.displayName],
  );

  const leave = useCallback(async () => {
    intentionalLeaveRef.current = true;
    connectGen.current += 1;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    const ch = channelIdRef.current;
    const gid = guildIdRef.current;
    // Ref’leri hemen kes — AppState reconnect / heartbeat olmasın
    channelIdRef.current = null;
    guildIdRef.current = null;
    channelNameRef.current = null;
    channelTypeRef.current = null;
    afkSilenceRef.current = false;
    afkVoiceChannelTrackedRef.current = null;
    setVoiceChannelType(null);
    // Ayrılma tonu — AudioSession kapanmadan önce
    if (ch) playUiTone('leave');
    // Presence önce — sonra UI; aksi halde reload eski üyeyi geri getirir
    if (ch) {
      try {
        await client.leaveVoiceState(ch);
      } catch {
        /* ignore */
      }
      if (gid) {
        try {
          client.emitVoiceState({ guildId: gid, channelId: null });
        } catch {
          /* ignore */
        }
      }
    }
    setVoiceChannelId(null);
    setVoiceGuildId(null);
    setVoiceChannelName(null);
    setVoiceOnOtherClient(false);
    setElsewherePlatform(null);
    setStatus('');
    setPeers([]);
    await disconnectLiveKit();
    void stopVoiceCallService();
    try {
      await AudioSession.stopAudioSession();
    } catch {
      /* ignore */
    }
  }, [client, disconnectLiveKit]);

  const join = useCallback(
    async (
      guildId: string,
      channel: { id: string; name: string; type?: string },
      opts?: { reclaim?: boolean },
    ) => {
      ensureLiveKit();
      intentionalLeaveRef.current = false;
      const chType = channel.type ?? channelTypeRef.current ?? 'VOICE';

      if (channelIdRef.current === channel.id && roomRef.current && !opts?.reclaim) {
        const state = roomRef.current.state;
        if (state === ConnectionState.Connected || state === ConnectionState.Reconnecting) {
          setVoiceGuildId(guildId);
          guildIdRef.current = guildId;
          setVoiceChannelName(channel.name);
          channelNameRef.current = channel.name;
          channelTypeRef.current = chType;
          setVoiceChannelType(chType);
          setVoiceOnOtherClient(false);
          return;
        }
      }

      const gen = ++connectGen.current;
      const stillThisJoin = () =>
        gen === connectGen.current && !intentionalLeaveRef.current;

      const prev = channelIdRef.current;
      if (prev && prev !== channel.id) {
        try {
          await client.leaveVoiceState(prev);
        } catch {
          /* ignore */
        }
      }
      if (!stillThisJoin()) return;
      await disconnectLiveKit();
      if (!stillThisJoin()) return;

      await prepareAudioSession();
      if (!stillThisJoin()) return;
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
      // Leave yarışı: await sonrası hâlâ bu join mi?
      if (!stillThisJoin()) {
        try {
          await room.disconnect();
        } catch {
          /* ignore */
        }
        return;
      }
      roomRef.current = room;
      channelIdRef.current = channel.id;
      guildIdRef.current = guildId;
      channelNameRef.current = channel.name;
      channelTypeRef.current = chType;
      setVoiceChannelId(channel.id);
      setVoiceGuildId(guildId);
      setVoiceChannelName(channel.name);
      setVoiceChannelType(chType);
      setStatus('Bağlanıyor…');
      setVoiceOnOtherClient(false);
      setElsewherePlatform(null);
      // Yeni kanala giriş → AFK idle sayacı (AFK hedefi değilse)
      lastSpokeAtRef.current = Date.now();
      afkVoiceChannelTrackedRef.current = channel.id;

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

      room.on(RoomEvent.ParticipantConnected, () => {
        playUiTone('peer-join');
        refreshPeers(room);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        if (!intentionalLeaveRef.current) playUiTone('peer-leave');
        refreshPeers(room);
      });
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
        if (!stillThisJoin()) {
          await client.leaveVoiceState(channel.id).catch(() => undefined);
          if (roomRef.current === room) {
            roomRef.current = null;
            channelIdRef.current = null;
            guildIdRef.current = null;
            channelNameRef.current = null;
            setVoiceChannelId(null);
            setVoiceGuildId(null);
            setVoiceChannelName(null);
            setConnected(false);
          }
          try {
            await room.disconnect();
          } catch {
            /* ignore */
          }
          return;
        }
        const tok = await client.getVoiceToken(channel.id);
        if (!stillThisJoin()) {
          await client.leaveVoiceState(channel.id).catch(() => undefined);
          if (roomRef.current === room) {
            roomRef.current = null;
            channelIdRef.current = null;
            guildIdRef.current = null;
            channelNameRef.current = null;
            setVoiceChannelId(null);
            setVoiceGuildId(null);
            setVoiceChannelName(null);
            setConnected(false);
          }
          try {
            await room.disconnect();
          } catch {
            /* ignore */
          }
          return;
        }
        await room.connect(tok.url, tok.token);
        if (!stillThisJoin()) {
          try {
            await room.disconnect();
          } catch {
            /* ignore */
          }
          await client.leaveVoiceState(channel.id).catch(() => undefined);
          if (roomRef.current === room) {
            roomRef.current = null;
            channelIdRef.current = null;
            setVoiceChannelId(null);
            setVoiceGuildId(null);
            setVoiceChannelName(null);
            setConnected(false);
          }
          return;
        }
        await room.localParticipant.setMicrophoneEnabled(
          !mutedRef.current && !deafenedRef.current,
        );
        setConnected(true);
        setStatus('Bağlı');
        refreshPeers(room);
        if (!opts?.reclaim) playUiTone('join');
        void startVoiceCallService({
          channelName: channel.name,
          connected: true,
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
      } catch (e) {
        if (!stillThisJoin()) return;
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
    const type = channelTypeRef.current ?? undefined;
    if (!ch || !gid) return;
    await join(gid, { id: ch, name: name ?? 'Ses', type }, { reclaim: true });
  }, [join, voiceChannelName]);

  const setMuted = useCallback(
    (v: boolean) => {
      if (afkSilenceRef.current && !v) return; // AFK kanalında mic açılamaz
      setMutedState(v);
      mutedRef.current = v;
      void roomRef.current?.localParticipant.setMicrophoneEnabled(
        !v && !deafenedRef.current && !afkSilenceRef.current,
      );
      const ch = channelIdRef.current;
      if (ch) void client.updateVoiceState(ch, { muted: v }).catch(() => undefined);
      syncCallNotification({ muted: v });
    },
    [client, syncCallNotification],
  );

  const setDeafened = useCallback(
    (v: boolean) => {
      if (afkSilenceRef.current && !v) return; // AFK kanalında deafen kaldırılamaz
      setDeafenedState(v);
      deafenedRef.current = v;
      for (const el of attachedAudio.current) {
        if (typeof el === 'object' && el && 'muted' in el) {
          (el as HTMLAudioElement).muted = v || afkSilenceRef.current;
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

  const applyAfkSilence = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        if (!afkSilenceRef.current) return;
        afkSilenceRef.current = false;
        setDeafened(false);
        setMuted(false);
        return;
      }
      if (afkSilenceRef.current) return;
      afkSilenceRef.current = true;
      setMuted(true);
      setDeafened(true);
    },
    [setMuted, setDeafened],
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
        void join(gid, {
          id: ch,
          name: name ?? 'Ses',
          type: channelTypeRef.current ?? undefined,
        });
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

  // Sunucu AFK ayarlarını yükle
  useEffect(() => {
    if (!voiceGuildId || !user) {
      setAfkChannelId(null);
      setAfkTimeoutMinutes(0);
      return;
    }
    let cancelled = false;
    void client
      .getGuild(voiceGuildId)
      .then((g) => {
        if (cancelled) return;
        setAfkChannelId(g.afkChannelId ?? null);
        setAfkTimeoutMinutes(g.afkTimeoutMinutes ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [voiceGuildId, user, client]);

  // AFK kanalındayken zorla sessizlik
  useEffect(() => {
    const inAfk = Boolean(
      afkChannelId && connected && voiceChannelId === afkChannelId && voiceGuildId,
    );
    applyAfkSilence(inAfk);
  }, [afkChannelId, voiceChannelId, voiceGuildId, connected, applyAfkSilence]);

  // AFK otomatik taşıma: sadece VOICE; GAME / WATCH_PARTY hariç
  // Belirlenen süre (dk) boyunca konuşma yoksa AFK kanalına al
  useEffect(() => {
    const afkId = afkChannelId;
    const timeoutMin = afkTimeoutMinutes;
    const chId = voiceChannelId;
    if (!afkId || timeoutMin <= 0 || !chId || !voiceGuildId || !connected || !user) {
      afkVoiceChannelTrackedRef.current = null;
      return;
    }

    if (chId !== afkVoiceChannelTrackedRef.current) {
      afkVoiceChannelTrackedRef.current = chId;
      if (chId !== afkId) {
        lastSpokeAtRef.current = Date.now();
      }
    }

    const chType = voiceChannelType ?? channelTypeRef.current ?? 'VOICE';
    if (chType === 'GAME' || chType === 'WATCH_PARTY') {
      lastSpokeAtRef.current = Date.now();
      return;
    }

    const self = peers.find((p) => p.id === user.id);
    selfSpeakingRef.current = Boolean(self?.speaking);
    if (selfSpeakingRef.current) {
      lastSpokeAtRef.current = Date.now();
    }

    const tick = setInterval(() => {
      if (afkMovingRef.current) return;
      if (channelIdRef.current === afkId) return;
      const typeNow = channelTypeRef.current ?? 'VOICE';
      if (typeNow === 'GAME' || typeNow === 'WATCH_PARTY') {
        lastSpokeAtRef.current = Date.now();
        return;
      }
      if (selfSpeakingRef.current) {
        lastSpokeAtRef.current = Date.now();
        return;
      }
      const idleMs = Date.now() - lastSpokeAtRef.current;
      if (idleMs < timeoutMin * 60_000) return;

      const gid = guildIdRef.current;
      if (!gid) return;
      afkMovingRef.current = true;
      void (async () => {
        try {
          const chs = await client.getGuildChannels(gid);
          const afkCh = chs.find((c) => c.id === afkId);
          if (!afkCh) return;
          await join(gid, {
            id: afkCh.id,
            name: afkCh.name,
            type: afkCh.type,
          });
        } catch {
          /* ignore */
        } finally {
          setTimeout(() => {
            afkMovingRef.current = false;
          }, 2000);
        }
      })();
    }, 5000);

    return () => clearInterval(tick);
  }, [
    afkChannelId,
    afkTimeoutMinutes,
    voiceChannelId,
    voiceGuildId,
    voiceChannelType,
    connected,
    peers,
    user,
    client,
    join,
  ]);

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
      voiceChannelType,
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
      voiceChannelType,
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
