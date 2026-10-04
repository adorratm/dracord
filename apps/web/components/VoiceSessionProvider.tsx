'use client';

import type { VoiceParticipant } from '@dracord/ui';
import { SocketEvents } from '@dracord/sdk';
import {
  LocalTrack,
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  type AudioCaptureOptions,
  type LocalAudioTrack,
  type LocalParticipant,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type TrackPublishOptions,
} from 'livekit-client';
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
import { useAuth } from '@/components/AuthProvider';
import { MicGainProcessor } from '@/lib/mic-gain-processor';
import { playUiTone } from '@/lib/sounds';
import {
  clearActiveVoice,
  readActiveVoice,
  saveActiveVoice,
} from '@/lib/voice-session-storage';
import {
  createTabId,
  openVoiceTabChannel,
  postVoiceTabMessage,
  type VoiceTabMessage,
} from '@/lib/voice-tab-sync';
import {
  audioBitrateToMaxBitrate,
  loadVoiceAudioSettings,
  micVolumeToPresenceDb,
  normalizeBitrateKbps,
  saveVoiceAudioSettings,
  type VoiceAudioSettings,
  type VoiceBitrateKbps,
} from '@/lib/voice-settings';
import {
  loadParticipantVolumes,
  loadScreenShareVolumes,
  saveParticipantVolumes,
  saveScreenShareVolumes,
} from '@/lib/participant-volumes';

export interface ActiveScreenShare {
  identity: string;
  displayName: string;
  isLocal: boolean;
}

interface VoiceSessionValue {
  voiceChannelId: string | null;
  voiceGuildId: string | null;
  connected: boolean;
  /** Bu sekme LiveKit lideri mi (çoklu sekmede yalnızca biri true) */
  isVoiceLeader: boolean;
  /** Ses başka sekmede; bu sekme dinlemiyor */
  voiceOnOtherTab: boolean;
  /** WebRTC RTT (ping), ms */
  latencyMs: number | null;
  muted: boolean;
  deafened: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  activeScreenShare: ActiveScreenShare | null;
  /** Odadaki tüm aktif ekran paylaşımları */
  availableScreenShares: ActiveScreenShare[];
  /** İzleyici ekran görünümü duraklatıldı (publish devam eder) */
  screenShareViewPaused: boolean;
  focusScreenShare: (identity: string) => void;
  /** İzlemeyi durdur (paylaşımı kapatmaz) */
  pauseScreenShareView: () => void;
  /** İzlemeye devam et */
  resumeScreenShareView: () => void;
  setScreenVideoElement: (el: HTMLVideoElement | null) => void;
  setCameraVideoElement: (identity: string, el: HTMLVideoElement | null) => void;
  participants: VoiceParticipant[];
  participantVolumes: Record<string, number>;
  /** Ekran paylaşımı (sistem) sesi — mikrofondan bağımsız, 0–100 */
  screenShareVolumes: Record<string, number>;
  error: string | null;
  /** Tarayıcı autoplay engeli — kullanıcı jesti ile unlockAudio çağır */
  audioPlaybackBlocked: boolean;
  unlockAudio: () => Promise<void>;
  noiseCancellation: boolean;
  noiseNote: string | null;
  audioSettings: VoiceAudioSettings;
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  refreshAudioDevices: (requestPermissions?: boolean) => Promise<void>;
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  setVideoDevice: (deviceId: string) => Promise<void>;
  setMicVolume: (volume: number) => void;
  setOutputVolume: (volume: number) => void;
  setAudioBitrate: (kbps: VoiceBitrateKbps) => Promise<void>;
  setParticipantVolume: (identity: string, volume: number) => void;
  getParticipantVolume: (identity: string) => number;
  /** Yerel mute toggle — sadece bu istemci; volume 0 / önceki seviye */
  toggleLocalMuteParticipant: (identity: string) => void;
  isLocalMutedParticipant: (identity: string) => boolean;
  setScreenShareVolume: (identity: string, volume: number) => void;
  getScreenShareVolume: (identity: string) => number;
  join: (
    channelId: string,
    guildId: string,
    opts?: { password?: string },
  ) => Promise<void>;
  /** iOS: tıklama jesti içinde mikrofon izni al (join öncesi / API await öncesi) */
  prepareMicrophone: () => Promise<void>;
  leave: () => string | null;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  /** Mutlak mute — AFK giriş/çıkış için (toggle yarışı yok) */
  setMute: (muted: boolean) => Promise<void>;
  /** Mutlak deafen — açılınca mic de açılır, kapanınca mic de kapanır */
  setDeafen: (deafened: boolean) => Promise<void>;
  /** AFK kanalı: zorla mute+deafen, toggle’lar yok sayılır, kimse duyulmaz */
  setAfkSilence: (enabled: boolean) => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleNoiseCancellation: () => Promise<void>;
}

const VoiceSessionContext = createContext<VoiceSessionValue | null>(null);

function metaFromParticipant(p: { metadata?: string }): {
  avatarUrl: string | null;
  isBot: boolean;
} {
  if (!p.metadata) return { avatarUrl: null, isBot: false };
  try {
    const parsed = JSON.parse(p.metadata) as {
      avatarUrl?: string | null;
      isBot?: boolean;
    };
    return {
      avatarUrl: parsed.avatarUrl ?? null,
      isBot: Boolean(parsed.isBot),
    };
  } catch {
    return { avatarUrl: null, isBot: false };
  }
}

function participantFromRemote(p: RemoteParticipant): VoiceParticipant {
  const audioPub = p.getTrackPublication(Track.Source.Microphone);
  const cameraPub = p.getTrackPublication(Track.Source.Camera);
  const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
  const meta = metaFromParticipant(p);
  // Yayın yokken muted varsayma — aksi halde Track flicker’da herkes “mute”e yapışır
  const muted = audioPub ? Boolean(audioPub.isMuted) : false;
  return {
    id: p.identity,
    displayName: p.name || p.identity,
    avatarUrl: meta.avatarUrl,
    muted,
    speaking: !muted && p.isSpeaking,
    camera: Boolean(cameraPub?.track && !cameraPub.isMuted),
    video: Boolean(screenPub?.track),
    isBot: meta.isBot || p.identity === 'system-dracord-bot',
  };
}

function participantFromLocal(p: LocalParticipant, muted: boolean): VoiceParticipant {
  const cameraPub = p.getTrackPublication(Track.Source.Camera);
  const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
  const meta = metaFromParticipant(p);
  return {
    id: p.identity,
    displayName: p.name || p.identity,
    avatarUrl: meta.avatarUrl,
    muted,
    speaking: p.isSpeaking,
    camera: Boolean(cameraPub?.track && !cameraPub.isMuted),
    video: Boolean(screenPub?.track),
    isBot: meta.isBot,
  };
}

function getMicTrack(room: Room): LocalAudioTrack | undefined {
  const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const track = pub?.track;
  return track && track.kind === 'audio' ? (track as LocalAudioTrack) : undefined;
}

function voiceAudioCaptureOptions(settings: VoiceAudioSettings): AudioCaptureOptions {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // sampleRate sabitleme bazı mobil tarayıcılarda constraint hatası verir
    deviceId: settings.inputDeviceId || undefined,
  };
}

function voiceAudioPublishOptions(kbps: number): TrackPublishOptions {
  return {
    audioPreset: { maxBitrate: audioBitrateToMaxBitrate(kbps) },
    dtx: false,
  };
}

/** Publisher PeerConnection üzerinden anlık RTT (ms). */
async function readPublisherRttMs(room: Room): Promise<number | null> {
  try {
    for (const pub of room.localParticipant.trackPublications.values()) {
      const track = pub.track;
      if (!(track instanceof LocalTrack) || !track.sender) continue;
      const report = await track.sender.getStats();
      let pairMs: number | undefined;
      let remoteMs: number | undefined;
      report.forEach((stat) => {
        if (stat.type === 'candidate-pair') {
          const pair = stat as RTCIceCandidatePairStats & { selected?: boolean };
          if (
            typeof pair.currentRoundTripTime === 'number' &&
            (pair.nominated || pair.selected)
          ) {
            pairMs = pair.currentRoundTripTime * 1000;
          }
        }
        if (stat.type === 'remote-inbound-rtp') {
          const rtt = (stat as { roundTripTime?: number }).roundTripTime;
          if (typeof rtt === 'number') remoteMs = rtt * 1000;
        }
      });
      const ms = pairMs ?? remoteMs;
      if (ms != null && Number.isFinite(ms)) return Math.max(0, Math.round(ms));
    }
  } catch {
    // ignore
  }
  return null;
}

function applyDeafen(room: Room, deafened: boolean) {
  room.remoteParticipants.forEach((p) => {
    p.audioTrackPublications.forEach((pub) => {
      try {
        pub.setEnabled(!deafened);
      } catch {
        // ignore
      }
    });
  });
}

/** Deafen kapalıyken uzak ses aboneliklerini yeniden aç (hayalet sessizlik) */
function ensureRemoteAudioReceiving(room: Room, deafened: boolean) {
  if (deafened) {
    applyDeafen(room, true);
    return;
  }
  room.remoteParticipants.forEach((p) => {
    p.audioTrackPublications.forEach((pub) => {
      try {
        if (!pub.isEnabled) pub.setEnabled(true);
      } catch {
        // ignore
      }
      const track = pub.track;
      if (!track || track.kind !== Track.Kind.Audio) return;
      try {
        const attached = track.attach();
        const els = Array.isArray(attached) ? attached : [attached];
        for (const el of els) {
          if (el instanceof HTMLAudioElement) {
            el.setAttribute('data-lk-remote-audio', p.identity);
            el.autoplay = true;
            void el.play().catch(() => undefined);
          }
        }
      } catch {
        // ignore
      }
    });
  });
}

function setRemoteSourceVolume(
  participant: RemoteParticipant,
  source: Track.Source,
  level: number,
) {
  const pub = participant.getTrackPublication(source);
  const track = pub?.track as unknown as { setVolume?: (v: number) => void } | undefined;
  if (track && typeof track.setVolume === 'function') {
    track.setVolume(level);
  }
}

/** Mikrofon ve yayın sesini ayrı uygula (participant.setVolume hepsini birleştirir). */
function applyOutputVolume(
  room: Room,
  outputVolume: number,
  personalVolumes?: Map<string, number>,
  screenShareVolumes?: Map<string, number>,
) {
  room.remoteParticipants.forEach((p) => {
    const micPersonal = (personalVolumes?.get(p.identity) ?? 100) / 100;
    const sharePersonal = (screenShareVolumes?.get(p.identity) ?? 100) / 100;
    setRemoteSourceVolume(p, Track.Source.Microphone, outputVolume * micPersonal);
    setRemoteSourceVolume(p, Track.Source.ScreenShareAudio, outputVolume * sharePersonal);
  });
}

function clampVol(v: number) {
  if (Number.isNaN(v)) return 1;
  return Math.min(2, Math.max(0, v));
}

function screenShareErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (
    name === 'NotAllowedError' ||
    /permission denied|notallowed|denied by user/i.test(msg)
  ) {
    return 'Ekran paylaşımı iptal edildi veya tarayıcı izin vermedi. Tekrar tıkla; açılan pencerede bir sekme/pencere seçip “Paylaş”a bas.';
  }
  if (name === 'NotFoundError' || /not found/i.test(msg)) {
    return 'Paylaşılacak ekran veya pencere bulunamadı.';
  }
  if (/could not start audio source|audio source|getDisplayMedia.*audio/i.test(msg)) {
    return 'Sistem sesi alınamadı; paylaşım sessiz video ile devam edebilir. Tekrar dene veya tarayıcıda “sekme sesini paylaş”ı işaretle.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Ekran paylaşımı yalnızca güvenli bağlamda (localhost veya HTTPS) çalışır.';
  }
  return msg || 'Ekran paylaşımı başarısız';
}

function isScreenShareAudioFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /could not start audio source|audio source|NotReadableError|AbortError/i.test(msg);
}

function isIOSWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPhone/iPad/iPod + iPadOS desktop UA
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function micPermissionErrorMessage(err: unknown): string {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name?: string }).name)
      : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    if (isIOSWebKit()) {
      return 'Mikrofon izni gerekli. iOS’ta Chrome Safari motorunu kullanır: Ayarlar → Safari → Mikrofon’dan bu siteye izin ver, sonra kanala tekrar dokun. İzin penceresi açılırsa sayfa değişmeden “İzin Ver”e bas.';
    }
    return 'Mikrofon izni gerekli. Tarayıcı ayarlarından Dracord için mikrofonu aç, sonra ses odasına tekrar gir.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Mikrofon bulunamadı. Bir mikrofon bağla ve tekrar dene.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Mikrofon başka bir uygulama tarafından kullanılıyor olabilir.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Mikrofon yalnızca HTTPS (veya localhost) üzerinde çalışır.';
  }
  return err instanceof Error ? err.message : 'Mikrofon izni alınamadı';
}

/**
 * Mikrofon izni — iOS WebKit’te mutlaka kullanıcı jesti (click/touch) içinde çağrılmalı.
 * Navigasyon / await arkasından çağrılırsa izin penceresi anında kapanır.
 */
async function ensureMicrophonePermission(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Bu tarayıcı mikrofon erişimini desteklemiyor');
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw Object.assign(new Error('Güvenli bağlam gerekli'), { name: 'NotAllowedError' });
  }

  // iOS’ta Permissions API mikrofon için güvenilir değil; doğrudan getUserMedia
  if (!isIOSWebKit()) {
    try {
      const status = await navigator.permissions?.query?.({
        name: 'microphone' as PermissionName,
      });
      if (status?.state === 'denied') {
        throw Object.assign(new Error('Mikrofon izni reddedildi'), {
          name: 'NotAllowedError',
        });
      }
      if (status?.state === 'granted') return;
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name: string }).name === 'NotAllowedError'
      ) {
        throw err;
      }
    }
  }

  // Basit constraint — iOS’ta karmaşık audio constraints prompt’u bozabiliyor
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (
    name === 'NotAllowedError' ||
    /permission denied|notallowed|denied by user/i.test(msg)
  ) {
    return 'Kamera izni reddedildi. Tarayıcı ayarlarından kamera erişimine izin ver.';
  }
  if (name === 'NotFoundError' || /not found|requested device not found/i.test(msg)) {
    return 'Kamera bulunamadı. Bağlı bir webcam olduğundan emin ol.';
  }
  if (name === 'NotReadableError' || /could not start|in use/i.test(msg)) {
    return 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Kamera yalnızca güvenli bağlamda (localhost veya HTTPS) çalışır.';
  }
  return msg || 'Kamera açılamadı';
}

export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const { client, user } = useAuth();
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [voiceGuildId, setVoiceGuildId] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const deepFilterActiveRef = useRef(false);
  const clarityRef = useRef<{ setPresenceGainDb: (db: number) => void } | null>(null);
  const micGainRef = useRef<MicGainProcessor | null>(null);
  const deafenedRef = useRef(false);
  const afkSilenceRef = useRef(false);
  const knownPeersRef = useRef(new Set<string>());
  const screenTrackRef = useRef<Track | null>(null);
  const screenVideoElRef = useRef<HTMLVideoElement | null>(null);
  /** Kullanıcının seçtiği ekran paylaşımı; '__none__' = bilerek izleme yok */
  const focusedScreenShareIdRef = useRef<string | null>(null);
  const activeScreenShareIdRef = useRef<string | null>(null);
  const screenShareViewPausedRef = useRef(false);
  const preMuteVolumesRef = useRef<Map<string, number>>(new Map());
  const cameraTracksRef = useRef<Map<string, Track>>(new Map());
  const cameraElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const mutedRef = useRef(false);
  const channelIdRef = useRef<string | null>(null);
  const guildIdRef = useRef<string | null>(null);
  const audioSettingsRef = useRef<VoiceAudioSettings>(loadVoiceAudioSettings());
  const participantVolumesRef = useRef<Map<string, number>>(new Map());
  const screenShareVolumesRef = useRef<Map<string, number>>(new Map());
  const restoringRef = useRef(false);
  const intentionalLeaveRef = useRef(false);
  /** Liderlik başka sekmeye geçerken presence’ı bırakma */
  const transferringLeadershipRef = useRef(false);
  const voicePasswordRef = useRef<string | undefined>(undefined);
  const tabIdRef = useRef(createTabId());
  const voiceBcRef = useRef<BroadcastChannel | null>(null);
  const isLeaderRef = useRef(true);

  const [connected, setConnected] = useState(false);
  const [isVoiceLeader, setIsVoiceLeader] = useState(true);
  const [voiceOnOtherTab, setVoiceOnOtherTab] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeScreenShare, setActiveScreenShare] = useState<ActiveScreenShare | null>(null);
  const [availableScreenShares, setAvailableScreenShares] = useState<ActiveScreenShare[]>([]);
  const [screenShareViewPaused, setScreenShareViewPaused] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [screenShareVolumes, setScreenShareVolumes] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [noiseCancellation, setNoiseCancellation] = useState(false);
  const [noiseNote, setNoiseNote] = useState<string | null>(null);
  const [audioSettings, setAudioSettings] = useState<VoiceAudioSettings>(() =>
    loadVoiceAudioSettings(),
  );
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);

  mutedRef.current = muted;
  channelIdRef.current = voiceChannelId;
  guildIdRef.current = voiceGuildId;
  isLeaderRef.current = isVoiceLeader;
  audioSettingsRef.current = audioSettings;

  const claimVoiceLeadership = useCallback((channelId: string, guildId: string) => {
    setIsVoiceLeader(true);
    setVoiceOnOtherTab(false);
    postVoiceTabMessage(voiceBcRef.current, {
      type: 'claim',
      tabId: tabIdRef.current,
      channelId,
      guildId,
      at: Date.now(),
    });
  }, []);

  /** Çoklu sekme: yalnızca odaklanan sekme LiveKit lideri olur */
  useEffect(() => {
    const bc = openVoiceTabChannel((msg: VoiceTabMessage) => {
      if (msg.type === 'claim') {
        if (msg.tabId === tabIdRef.current) return;
        if (channelIdRef.current && msg.channelId === channelIdRef.current) {
          transferringLeadershipRef.current = true;
          setIsVoiceLeader(false);
          setVoiceOnOtherTab(true);
          window.setTimeout(() => {
            transferringLeadershipRef.current = false;
          }, 800);
        }
        return;
      }
      if (msg.type === 'leave') {
        if (msg.tabId === tabIdRef.current) return;
        const ch = channelIdRef.current;
        const g = guildIdRef.current;
        const wasLeader = isLeaderRef.current;
        intentionalLeaveRef.current = true;
        clearActiveVoice();
        setVoiceChannelId(null);
        setVoiceGuildId(null);
        setVoiceOnOtherTab(false);
        setIsVoiceLeader(true);
        if (wasLeader && ch) {
          void client.leaveVoiceState(ch).catch(() => undefined);
          if (g) client.emitVoiceState({ guildId: g, channelId: null });
        }
      }
    });
    voiceBcRef.current = bc;
    return () => {
      bc?.close();
      voiceBcRef.current = null;
    };
  }, [client]);

  useEffect(() => {
    const onFocus = () => {
      const ch = channelIdRef.current;
      const g = guildIdRef.current;
      if (!ch || !g) return;
      if (document.visibilityState !== 'visible') return;
      claimVoiceLeadership(ch, g);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [claimVoiceLeadership]);

  useEffect(() => {
    if (!voiceChannelId || !voiceGuildId) return;
    // Gizli/arka plan sekme restore’da lider olmasın — bot + LiveKit çakışmasın
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      setIsVoiceLeader(false);
      setVoiceOnOtherTab(true);
      return;
    }
    claimVoiceLeadership(voiceChannelId, voiceGuildId);
  }, [voiceChannelId, voiceGuildId, claimVoiceLeadership]);

  useEffect(() => {
    const loaded = loadParticipantVolumes();
    participantVolumesRef.current = new Map(Object.entries(loaded));
    setParticipantVolumes(loaded);
    const shareLoaded = loadScreenShareVolumes();
    screenShareVolumesRef.current = new Map(Object.entries(shareLoaded));
    setScreenShareVolumes(shareLoaded);
  }, []);

  const persistAudio = useCallback((next: VoiceAudioSettings) => {
    setAudioSettings(next);
    audioSettingsRef.current = next;
    saveVoiceAudioSettings(next);
  }, []);

  const refreshAudioDevices = useCallback(async (requestPermissions = false) => {
    // requestPermissions=true yalnızca kullanıcı ses ayarlarında yenile dediğinde
    // video için asla burada izin isteme — kamera açılınca istenir
    try {
      const [inputs, outputs, videos] = await Promise.all([
        Room.getLocalDevices('audioinput', requestPermissions),
        Room.getLocalDevices('audiooutput', false),
        Room.getLocalDevices('videoinput', false),
      ]);
      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);
      setVideoInputDevices(videos);
    } catch {
      setAudioInputDevices([]);
      setAudioOutputDevices([]);
      setVideoInputDevices([]);
    }
  }, []);

  // Cihaz listesi: yalnızca giriş yapılmışsa ve izin istemeden
  useEffect(() => {
    if (!user) {
      setAudioInputDevices([]);
      setAudioOutputDevices([]);
      setVideoInputDevices([]);
      return;
    }
    void refreshAudioDevices(false);
  }, [user, refreshAudioDevices]);

  const applyMicGainToTrack = useCallback(async (mic: LocalAudioTrack, volume: number) => {
    if (deepFilterActiveRef.current) {
      clarityRef.current?.setPresenceGainDb(micVolumeToPresenceDb(volume));
      return;
    }
    let proc = micGainRef.current;
    if (!proc) {
      proc = new MicGainProcessor(volume);
      micGainRef.current = proc;
      await mic.setProcessor(proc);
    } else {
      proc.setGain(volume);
    }
  }, []);

  const applyRoomAudioSettings = useCallback(
    async (room: Room, settings: VoiceAudioSettings) => {
      let next = settings;
      try {
        if (settings.inputDeviceId) {
          const inputs = await Room.getLocalDevices('audioinput', false);
          const stillThere = inputs.some((d) => d.deviceId === settings.inputDeviceId);
          if (stillThere) {
            await room.switchActiveDevice('audioinput', settings.inputDeviceId);
          } else {
            next = { ...next, inputDeviceId: '' };
            persistAudio(next);
          }
        }
      } catch {
        // cihaz yoksa yoksay
      }
      try {
        if (settings.outputDeviceId) {
          const outputs = await Room.getLocalDevices('audiooutput', false);
          const stillThere = outputs.some((d) => d.deviceId === settings.outputDeviceId);
          if (stillThere) {
            await room.switchActiveDevice('audiooutput', settings.outputDeviceId);
          } else {
            next = { ...next, outputDeviceId: '' };
            persistAudio(next);
          }
        }
      } catch {
        // sinkId desteklenmiyorsa yoksay
      }
      applyOutputVolume(
        room,
        next.outputVolume,
        participantVolumesRef.current,
        screenShareVolumesRef.current,
      );
      const mic = getMicTrack(room);
      if (mic) {
        await applyMicGainToTrack(mic, next.micVolume).catch(() => undefined);
      }
    },
    [applyMicGainToTrack, persistAudio],
  );

  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setAudioPlaybackBlocked(!room.canPlaybackAudio);
    } catch {
      setAudioPlaybackBlocked(true);
    }
  }, []);

  const reapplyDevicesAfterChange = useCallback(async () => {
    await refreshAudioDevices(false);
    const room = roomRef.current;
    if (!room) return;
    const settings = audioSettingsRef.current;
    try {
      const [inputs, outputs] = await Promise.all([
        Room.getLocalDevices('audioinput', false),
        Room.getLocalDevices('audiooutput', false),
      ]);
      let next = { ...settings };
      if (settings.inputDeviceId && !inputs.some((d) => d.deviceId === settings.inputDeviceId)) {
        next.inputDeviceId = '';
      }
      if (settings.outputDeviceId && !outputs.some((d) => d.deviceId === settings.outputDeviceId)) {
        next.outputDeviceId = '';
      }
      if (next.inputDeviceId !== settings.inputDeviceId || next.outputDeviceId !== settings.outputDeviceId) {
        persistAudio(next);
      }
      await applyRoomAudioSettings(room, next);
    } catch {
      // ignore
    }
  }, [refreshAudioDevices, applyRoomAudioSettings, persistAudio]);

  // Sistem cihazları değişince liste + aktif cihazı yeniden uygula
  useEffect(() => {
    if (!user) return;
    const onChange = () => void reapplyDevicesAfterChange();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, [user, reapplyDevicesAfterChange]);

  const refreshParticipants = useCallback((room: Room, isMuted: boolean) => {
    const list: VoiceParticipant[] = [];
    if (room.localParticipant) {
      list.push(participantFromLocal(room.localParticipant, isMuted));
    }
    room.remoteParticipants.forEach((p) => {
      list.push(participantFromRemote(p));
      const out = audioSettingsRef.current.outputVolume;
      const micVol = (participantVolumesRef.current.get(p.identity) ?? 100) / 100;
      const shareVol = (screenShareVolumesRef.current.get(p.identity) ?? 100) / 100;
      setRemoteSourceVolume(p, Track.Source.Microphone, out * micVol);
      setRemoteSourceVolume(p, Track.Source.ScreenShareAudio, out * shareVol);
    });
    setParticipants(list);
  }, []);

  const clearScreenShareView = useCallback(() => {
    const el = screenVideoElRef.current;
    const track = screenTrackRef.current;
    if (el && track) {
      try {
        track.detach(el);
      } catch {
        // ignore
      }
    }
    screenTrackRef.current = null;
    activeScreenShareIdRef.current = null;
    setActiveScreenShare(null);
  }, []);

  const clearCameraViews = useCallback(() => {
    for (const [identity, track] of cameraTracksRef.current) {
      const el = cameraElsRef.current.get(identity);
      if (el) {
        try {
          track.detach(el);
        } catch {
          // ignore
        }
      }
    }
    cameraTracksRef.current.clear();
  }, []);

  const attachCameraEl = useCallback((identity: string, track: Track, el: HTMLVideoElement) => {
    track.attach(el);
    el.playsInline = true;
    el.autoplay = true;
    el.muted = true;
    void el.play().catch(() => undefined);
  }, []);

  const syncCameraTracks = useCallback(
    (room: Room) => {
      const next = new Map<string, Track>();
      const localCam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (localCam) next.set(room.localParticipant.identity, localCam);
      for (const p of room.remoteParticipants.values()) {
        const cam = p.getTrackPublication(Track.Source.Camera)?.track;
        if (cam) next.set(p.identity, cam);
      }

      for (const [identity, track] of cameraTracksRef.current) {
        if (!next.has(identity)) {
          const el = cameraElsRef.current.get(identity);
          if (el) {
            try {
              track.detach(el);
            } catch {
              // ignore
            }
          }
        }
      }

      cameraTracksRef.current = next;
      for (const [identity, track] of next) {
        const el = cameraElsRef.current.get(identity);
        if (el) attachCameraEl(identity, track, el);
      }
      setCameraEnabled(Boolean(localCam));
    },
    [attachCameraEl],
  );

  const setCameraVideoElement = useCallback(
    (identity: string, el: HTMLVideoElement | null) => {
      const prev = cameraElsRef.current.get(identity);
      const track = cameraTracksRef.current.get(identity);
      if (prev && track && prev !== el) {
        try {
          track.detach(prev);
        } catch {
          // ignore
        }
      }
      if (!el) {
        cameraElsRef.current.delete(identity);
        return;
      }
      cameraElsRef.current.set(identity, el);
      if (track) attachCameraEl(identity, track, el);
    },
    [attachCameraEl],
  );

  const listScreenShares = useCallback((room: Room): ActiveScreenShare[] => {
    const out: ActiveScreenShare[] = [];
    const localPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (localPub?.track) {
      out.push({
        identity: room.localParticipant.identity,
        displayName: room.localParticipant.name || room.localParticipant.identity,
        isLocal: true,
      });
    }
    for (const p of room.remoteParticipants.values()) {
      const pub = p.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track) {
        out.push({
          identity: p.identity,
          displayName: p.name || p.identity,
          isLocal: false,
        });
      }
    }
    return out;
  }, []);

  const bindScreenShareTrack = useCallback(
    (track: Track | null, identity: string, displayName: string, isLocal: boolean) => {
      const el = screenVideoElRef.current;
      const prev = screenTrackRef.current;

      // Aynı track + aynı kişi → yeniden attach etme (flicker kaynağı)
      if (track && prev === track && activeScreenShareIdRef.current === identity) {
        setActiveScreenShare({ identity, displayName, isLocal });
        return;
      }

      if (prev && el && prev !== track) {
        try {
          prev.detach(el);
        } catch {
          // ignore
        }
      }

      screenTrackRef.current = track;
      if (!track) {
        activeScreenShareIdRef.current = null;
        setActiveScreenShare(null);
        return;
      }

      activeScreenShareIdRef.current = identity;
      setActiveScreenShare({ identity, displayName, isLocal });
      if (el) {
        if (prev !== track) {
          track.attach(el);
        }
        el.playsInline = true;
        el.autoplay = true;
        el.muted = isLocal;
        void el.play().catch(() => undefined);
      }
    },
    [],
  );

  const setScreenVideoElement = useCallback((el: HTMLVideoElement | null) => {
    const prev = screenVideoElRef.current;
    const track = screenTrackRef.current;
    if (prev === el) return;
    if (prev && track) {
      try {
        track.detach(prev);
      } catch {
        // ignore
      }
    }
    screenVideoElRef.current = el;
    if (el && track) {
      track.attach(el);
      el.playsInline = true;
      el.autoplay = true;
      el.muted = activeScreenShareIdRef.current === roomRef.current?.localParticipant.identity;
      void el.play().catch(() => undefined);
    }
  }, []);

  /** Odadaki paylaşımları senkronize et; kullanıcı seçimini koru; gereksiz rebind yapma */
  const applyScreenShareView = useCallback(
    (room: Room) => {
      const shares = listScreenShares(room);
      setAvailableScreenShares(shares);
      setScreenSharing(shares.some((s) => s.isLocal));

      if (shares.length === 0) {
        focusedScreenShareIdRef.current = null;
        screenShareViewPausedRef.current = false;
        setScreenShareViewPaused(false);
        clearScreenShareView();
        return;
      }

      let focusId = focusedScreenShareIdRef.current;
      if (!focusId || focusId === '__none__' || !shares.some((s) => s.identity === focusId)) {
        const current = activeScreenShareIdRef.current;
        if (current && shares.some((s) => s.identity === current)) {
          focusId = current;
          focusedScreenShareIdRef.current = focusId;
        } else if (screenShareViewPausedRef.current) {
          // Duraklatılmışken odak kaybolduysa paylaşım yeniden gelene kadar boş bırak;
          // aynı yayıncı tekrar açarsa pause sıfırlanır (aşağıda TrackUnsubscribed).
          clearScreenShareView();
          return;
        } else {
          // İlk / yeni paylaşım: otomatik odakla (uzak öncelikli)
          focusId =
            shares.find((s) => !s.isLocal)?.identity ?? shares[0]!.identity;
          focusedScreenShareIdRef.current = focusId;
        }
      }

      if (screenShareViewPausedRef.current) {
        clearScreenShareView();
        return;
      }

      const share = shares.find((s) => s.identity === focusId) ?? shares[0]!;
      let track: Track | null = null;
      if (share.isLocal) {
        track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track ?? null;
      } else {
        const p = room.remoteParticipants.get(share.identity);
        const pub = p?.getTrackPublication(Track.Source.ScreenShare) as
          | RemoteTrackPublication
          | undefined;
        track = pub?.track ?? null;
        if (pub) {
          try {
            pub.setVideoQuality(VideoQuality.HIGH);
          } catch {
            // ignore
          }
        }
      }
      bindScreenShareTrack(track, share.identity, share.displayName, share.isLocal);
    },
    [bindScreenShareTrack, clearScreenShareView, listScreenShares],
  );

  const focusScreenShare = useCallback(
    (identity: string) => {
      const room = roomRef.current;
      if (!room) return;
      // Odak değişince pause korunur — kullanıcı devam et demeden video bağlanmaz
      focusedScreenShareIdRef.current = identity;
      applyScreenShareView(room);
    },
    [applyScreenShareView],
  );

  const pauseScreenShareView = useCallback(() => {
    const room = roomRef.current;
    const focus =
      focusedScreenShareIdRef.current && focusedScreenShareIdRef.current !== '__none__'
        ? focusedScreenShareIdRef.current
        : activeScreenShareIdRef.current;
    if (focus) focusedScreenShareIdRef.current = focus;
    screenShareViewPausedRef.current = true;
    setScreenShareViewPaused(true);
    clearScreenShareView();
    if (room) applyScreenShareView(room);
  }, [applyScreenShareView, clearScreenShareView]);

  const resumeScreenShareView = useCallback(() => {
    const room = roomRef.current;
    screenShareViewPausedRef.current = false;
    setScreenShareViewPaused(false);
    if (!room) return;
    const shares = listScreenShares(room);
    if (shares.length === 0) return;
    if (
      !focusedScreenShareIdRef.current ||
      focusedScreenShareIdRef.current === '__none__' ||
      !shares.some((s) => s.identity === focusedScreenShareIdRef.current)
    ) {
      focusedScreenShareIdRef.current =
        shares.find((s) => !s.isLocal)?.identity ?? shares[0]!.identity;
    }
    applyScreenShareView(room);
  }, [applyScreenShareView, listScreenShares]);

  useEffect(() => {
    if (!voiceChannelId || !user) {
      return;
    }
    if (!isVoiceLeader) {
      return;
    }

    const channelId = voiceChannelId;
    const guildId = voiceGuildId;
    let disposed = false;
    const settings = audioSettingsRef.current;
    const audioPublish = voiceAudioPublishOptions(settings.audioBitrateKbps);
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: voiceAudioCaptureOptions(settings),
      videoCaptureDefaults: {
        deviceId: settings.videoDeviceId || undefined,
        resolution: { width: 1280, height: 720, frameRate: 24 },
      },
      publishDefaults: audioPublish,
      audioOutput: settings.outputDeviceId
        ? { deviceId: settings.outputDeviceId }
        : undefined,
    });
    roomRef.current = room;
    deepFilterActiveRef.current = false;
    clarityRef.current = null;
    micGainRef.current = null;
    knownPeersRef.current = new Set();
    focusedScreenShareIdRef.current = null;
    activeScreenShareIdRef.current = null;
    setMuted(false);
    setDeafened(false);
    deafenedRef.current = false;
    setCameraEnabled(false);
    setAvailableScreenShares([]);
    setError(null);
    setNoiseCancellation(false);
    setNoiseNote(null);

    const syncMedia = () => {
      if (!disposed) {
        ensureRemoteAudioReceiving(room, deafenedRef.current || afkSilenceRef.current);
        applyScreenShareView(room);
        syncCameraTracks(room);
      }
    };
    const syncParticipants = () => {
      if (!disposed) refreshParticipants(room, mutedRef.current);
    };
    const syncAll = () => {
      syncParticipants();
      syncMedia();
    };

    room.on(RoomEvent.Connected, syncAll);
    room.on(RoomEvent.Disconnected, () => {
      if (!disposed) setConnected(false);
    });
    room.on(RoomEvent.ParticipantConnected, (p) => {
      if (!knownPeersRef.current.has(p.identity)) {
        knownPeersRef.current.add(p.identity);
        playUiTone('peer-join');
      }
      if (deafenedRef.current) applyDeafen(room, true);
      const out = audioSettingsRef.current.outputVolume;
      const micVol = (participantVolumesRef.current.get(p.identity) ?? 100) / 100;
      const shareVol = (screenShareVolumesRef.current.get(p.identity) ?? 100) / 100;
      setRemoteSourceVolume(p, Track.Source.Microphone, out * micVol);
      setRemoteSourceVolume(p, Track.Source.ScreenShareAudio, out * shareVol);
      syncAll();
    });
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      if (knownPeersRef.current.has(p.identity)) {
        knownPeersRef.current.delete(p.identity);
        if (!disposed && !intentionalLeaveRef.current) {
          playUiTone('peer-leave');
        }
      }
      syncAll();
    });
    room.on(RoomEvent.TrackMuted, syncAll);
    room.on(RoomEvent.TrackUnmuted, syncAll);
    // Konuşma halkası — ekran track'ini yeniden bağlama (flicker)
    room.on(RoomEvent.ActiveSpeakersChanged, syncParticipants);
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (deafenedRef.current && publication.kind === 'audio') {
        publication.setEnabled(false);
      }
      if (publication.kind === 'audio' || track.kind === Track.Kind.Audio) {
        publication.setEnabled(!deafenedRef.current);
        const out = audioSettingsRef.current.outputVolume;
        const isShareAudio = publication.source === Track.Source.ScreenShareAudio;
        const personal = isShareAudio
          ? (screenShareVolumesRef.current.get(participant.identity) ?? 100) / 100
          : (participantVolumesRef.current.get(participant.identity) ?? 100) / 100;
        const level = Math.max(0, Math.min(2, out * personal));
        if (participant instanceof Object && 'identity' in participant) {
          setRemoteSourceVolume(
            participant as RemoteParticipant,
            isShareAudio ? Track.Source.ScreenShareAudio : Track.Source.Microphone,
            level,
          );
        }
        try {
          const attached = track.attach();
          const els = Array.isArray(attached) ? attached : [attached];
          for (const el of els) {
            if (el instanceof HTMLAudioElement) {
              el.setAttribute('data-lk-remote-audio', participant.identity);
              el.autoplay = true;
              void el.play().catch(() => undefined);
            }
          }
        } catch {
          // ignore
        }
        void room.startAudio().catch(() => undefined);
      }
      if (publication.source === Track.Source.ScreenShare) {
        try {
          (publication as RemoteTrackPublication).setVideoQuality?.(VideoQuality.HIGH);
        } catch {
          // ignore
        }
      }
      syncAll();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) {
        const identity = participant?.identity;
        // Paylaşım kapanınca bu yayıncı için pause sıfırlanır; başka paylaşım varsa ona geç
        if (identity && focusedScreenShareIdRef.current === identity) {
          screenShareViewPausedRef.current = false;
          setScreenShareViewPaused(false);
          clearScreenShareView();
          focusedScreenShareIdRef.current = null;
        } else if (screenTrackRef.current === track) {
          clearScreenShareView();
        } else {
          try {
            track.detach();
          } catch {
            // ignore
          }
        }
        syncAll();
        return;
      }
      if (publication.source === Track.Source.Camera) {
        syncAll();
        return;
      }
      try {
        track.detach();
      } catch {
        // ignore
      }
      syncAll();
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioPlaybackBlocked(!room.canPlaybackAudio);
      if (!room.canPlaybackAudio) {
        void room.startAudio().catch(() => setAudioPlaybackBlocked(true));
      }
    });
    room.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        setScreenSharing(true);
        void client
          .updateVoiceState(channelId, { screenSharing: true })
          .catch(() => undefined);
      }
      if (publication.source === Track.Source.Camera) setCameraEnabled(true);
      syncAll();
    });
    room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        setScreenSharing(false);
        void client
          .updateVoiceState(channelId, { screenSharing: false })
          .catch(() => undefined);
      }
      if (publication.source === Track.Source.Camera) setCameraEnabled(false);
      syncAll();
    });

    void (async () => {
      try {
        // join() jest içinde izin aldı; restore gibi jestsiz yollar için güvenlik ağı
        try {
          await ensureMicrophonePermission();
        } catch (permErr) {
          throw new Error(micPermissionErrorMessage(permErr));
        }

        const password = voicePasswordRef.current;
        const { token, url } = await client.getVoiceToken(channelId, password);
        const livekitUrl =
          process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || url || 'ws://localhost:7880';
        await room.connect(livekitUrl, token);
        if (disposed) {
          room.disconnect();
          return;
        }

        try {
          await room.startAudio();
          setAudioPlaybackBlocked(!room.canPlaybackAudio);
        } catch {
          setAudioPlaybackBlocked(true);
        }
        try {
          await room.localParticipant.setMicrophoneEnabled(
            true,
            voiceAudioCaptureOptions(audioSettingsRef.current),
            voiceAudioPublishOptions(audioSettingsRef.current.audioBitrateKbps),
          );
        } catch (micErr) {
          room.disconnect();
          throw new Error(micPermissionErrorMessage(micErr));
        }
        // AFK sessizlik kilidi oda yenilenince de geçerli kalsın
        if (afkSilenceRef.current) {
          try {
            await room.localParticipant.setMicrophoneEnabled(false);
          } catch {
            // ignore
          }
          mutedRef.current = true;
          deafenedRef.current = true;
          setMuted(true);
          setDeafened(true);
          ensureRemoteAudioReceiving(room, true);
        }
        try {
          await room.startAudio();
          setAudioPlaybackBlocked(!room.canPlaybackAudio);
        } catch {
          setAudioPlaybackBlocked(true);
        }
        await applyRoomAudioSettings(room, audioSettingsRef.current);
        void refreshAudioDevices(false);
        try {
          await client.joinVoiceState(channelId, {
            muted: afkSilenceRef.current || mutedRef.current,
            deafened: afkSilenceRef.current || deafenedRef.current,
            password,
          });
          if (guildId) {
            client.connectSocket();
            client.emitVoiceState({
              guildId,
              channelId,
              muted: afkSilenceRef.current || mutedRef.current,
              deafened: afkSilenceRef.current || deafenedRef.current,
            });
          }
        } catch {
          // presence sync optional
        }

        playUiTone('join');
        setConnected(true);
        refreshParticipants(room, mutedRef.current);
        if (guildId) {
          saveActiveVoice({ guildId, channelId });
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Ses odasına bağlanılamadı');
          setVoiceChannelId(null);
          setVoiceGuildId(null);
          if (!restoringRef.current) {
            clearActiveVoice();
          }
        }
      }
    })();

    const heartbeat = window.setInterval(() => {
      void client.voiceHeartbeat(channelId).catch(() => undefined);
    }, 30_000);

    // Hayalet sessizlik: deafen yokken uzak ses aboneliklerini periyodik onar
    const audioHealth = window.setInterval(() => {
      if (disposed || !roomRef.current) return;
      ensureRemoteAudioReceiving(
        room,
        deafenedRef.current || afkSilenceRef.current,
      );
      if (!deafenedRef.current && !afkSilenceRef.current) {
        void room.startAudio().catch(() => undefined);
      }
    }, 8_000);

    /** Yenilemede presence kalsın (TTL 90s); sessionStorage ile hemen rejoin. */
    const onPageHide = () => {
      if (guildId) {
        saveActiveVoice({ guildId, channelId });
      }
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      window.clearInterval(audioHealth);
      window.removeEventListener('pagehide', onPageHide);
      deepFilterActiveRef.current = false;
      clarityRef.current = null;
      micGainRef.current = null;
      setNoiseCancellation(false);
      setNoiseNote(null);
      setScreenSharing(false);
      setCameraEnabled(false);
      clearScreenShareView();
      clearCameraViews();
      void (async () => {
        const saved = readActiveVoice();
        const shouldLeavePresence =
          !transferringLeadershipRef.current &&
          (intentionalLeaveRef.current || !saved || saved.channelId !== channelId);
        try {
          if (shouldLeavePresence) {
            await client.leaveVoiceState(channelId);
            if (guildId) {
              client.emitVoiceState({ guildId, channelId: null });
            }
          }
        } catch {
          // ignore
        }
        if (shouldLeavePresence) {
          playUiTone('leave');
        }
        room.disconnect();
      })();
      roomRef.current = null;
      setConnected(false);
      setParticipants([]);
    };
  }, [
    voiceChannelId,
    voiceGuildId,
    isVoiceLeader,
    client,
    user,
    refreshParticipants,
    applyScreenShareView,
    syncCameraTracks,
    clearScreenShareView,
    clearCameraViews,
    applyRoomAudioSettings,
    refreshAudioDevices,
  ]);

  useEffect(() => {
    if (!connected) {
      setLatencyMs(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const room = roomRef.current;
      if (!room || cancelled) return;
      const ms = await readPublisherRttMs(room);
      if (!cancelled && ms != null) setLatencyMs(ms);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connected, voiceChannelId]);

  /** Ctrl+F5 / yenileme sonrası aynı ses kanalına dön */
  useEffect(() => {
    if (!user) return;
    if (voiceChannelId) return;
    if (intentionalLeaveRef.current) return;
    const saved = readActiveVoice();
    if (!saved) return;
    intentionalLeaveRef.current = false;
    restoringRef.current = true;
    setVoiceGuildId(saved.guildId);
    setVoiceChannelId(saved.channelId);
    const t = window.setTimeout(() => {
      restoringRef.current = false;
    }, 4000);
    return () => window.clearTimeout(t);
  }, [user, voiceChannelId]);

  const prepareMicrophone = useCallback(async () => {
    setError(null);
    try {
      await ensureMicrophonePermission();
    } catch (permErr) {
      const msg = micPermissionErrorMessage(permErr);
      setError(msg);
      throw Object.assign(new Error(msg), {
        name:
          permErr && typeof permErr === 'object' && 'name' in permErr
            ? String((permErr as { name?: string }).name)
            : 'NotAllowedError',
      });
    }
  }, []);

  const join = useCallback(
    async (channelId: string, guildId: string, opts?: { password?: string }) => {
      intentionalLeaveRef.current = false;
      voicePasswordRef.current = opts?.password;
      // iOS WebKit: getUserMedia tıklama zincirinde olmalı; router.push / useEffect sonra prompt kapanır
      await prepareMicrophone();
      saveActiveVoice({ guildId, channelId });
      setVoiceChannelId((prev) => {
        if (prev === channelId) return prev;
        return channelId;
      });
      setVoiceGuildId(guildId);
      // Aynı kanalda bile odak sekmesi liderliği alsın (çoklu sekme)
      claimVoiceLeadership(channelId, guildId);
    },
    [claimVoiceLeadership, prepareMicrophone],
  );

  const leave = useCallback(() => {
    const channelId = channelIdRef.current;
    const guildId = guildIdRef.current;
    intentionalLeaveRef.current = true;
    transferringLeadershipRef.current = false;
    voicePasswordRef.current = undefined;
    clearActiveVoice();
    setVoiceChannelId(null);
    setVoiceGuildId(null);
    setConnected(false);
    setVoiceOnOtherTab(false);
    setIsVoiceLeader(true);
    setAudioPlaybackBlocked(false);
    setParticipants([]);
    setError(null);
    setScreenSharing(false);
    setCameraEnabled(false);
    setAvailableScreenShares([]);
    focusedScreenShareIdRef.current = null;
    clearScreenShareView();
    clearCameraViews();
    postVoiceTabMessage(voiceBcRef.current, {
      type: 'leave',
      tabId: tabIdRef.current,
      at: Date.now(),
    });
    // Lider olmasa bile presence temizle — aksi halde sol panelde hayalet avatar kalır.
    if (channelId) {
      void (async () => {
        try {
          await client.leaveVoiceState(channelId);
          if (guildId) {
            client.emitVoiceState({ guildId, channelId: null });
          }
        } catch {
          // ignore
        }
      })();
    }
    return channelId;
  }, [client, clearScreenShareView, clearCameraViews]);

  /** Yetkili kick: sunucu VOICE_STATE leave/move yayınladığında oturumu güncelle */
  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onVoice = (payload: {
      channelId: string | null;
      targetChannelId?: string | null;
      guildId?: string;
      user: { id: string };
      action: string;
    }) => {
      if (payload.user.id !== user.id) return;
      if (payload.action === 'move' && payload.targetChannelId && payload.guildId) {
        join(payload.targetChannelId, payload.guildId);
        return;
      }
      if (payload.action !== 'leave') return;
      if (!payload.channelId || payload.channelId !== channelIdRef.current) return;
      leave();
      setError('Bu odadan çıkarıldın veya girişin engellendi.');
    };
    sock.on(SocketEvents.VOICE_STATE, onVoice);
    return () => {
      sock.off(SocketEvents.VOICE_STATE, onVoice);
    };
  }, [user, client, leave, join]);

  const applyParticipantVolume = useCallback((identity: string, volume: number) => {
    const room = roomRef.current;
    if (!room) return;
    const remote = room.remoteParticipants.get(identity);
    if (!remote) return;
    const out = audioSettingsRef.current.outputVolume;
    setRemoteSourceVolume(
      remote,
      Track.Source.Microphone,
      out * (Math.max(0, Math.min(100, volume)) / 100),
    );
  }, []);

  const applyScreenShareAudioVolume = useCallback((identity: string, volume: number) => {
    const room = roomRef.current;
    if (!room) return;
    const remote = room.remoteParticipants.get(identity);
    if (!remote) return;
    const out = audioSettingsRef.current.outputVolume;
    setRemoteSourceVolume(
      remote,
      Track.Source.ScreenShareAudio,
      out * (Math.max(0, Math.min(100, volume)) / 100),
    );
  }, []);

  const setParticipantVolume = useCallback(
    (identity: string, volume: number) => {
      const v = Math.max(0, Math.min(200, Math.round(volume)));
      if (v > 0) preMuteVolumesRef.current.delete(identity);
      participantVolumesRef.current.set(identity, v);
      setParticipantVolumes((prev) => {
        if (prev[identity] === v) return prev;
        const next = { ...prev, [identity]: v };
        saveParticipantVolumes(next);
        return next;
      });
      applyParticipantVolume(identity, Math.min(100, v));
    },
    [applyParticipantVolume],
  );

  const getParticipantVolume = useCallback((identity: string) => {
    return participantVolumesRef.current.get(identity) ?? 100;
  }, []);

  const isLocalMutedParticipant = useCallback((identity: string) => {
    return (participantVolumesRef.current.get(identity) ?? 100) === 0;
  }, []);

  const toggleLocalMuteParticipant = useCallback(
    (identity: string) => {
      const cur = participantVolumesRef.current.get(identity) ?? 100;
      if (cur === 0) {
        const restore = preMuteVolumesRef.current.get(identity) ?? 100;
        preMuteVolumesRef.current.delete(identity);
        setParticipantVolume(identity, restore);
      } else {
        preMuteVolumesRef.current.set(identity, cur);
        setParticipantVolume(identity, 0);
      }
    },
    [setParticipantVolume],
  );

  const setScreenShareVolume = useCallback(
    (identity: string, volume: number) => {
      const v = Math.max(0, Math.min(100, Math.round(volume)));
      screenShareVolumesRef.current.set(identity, v);
      setScreenShareVolumes((prev) => {
        if (prev[identity] === v) return prev;
        const next = { ...prev, [identity]: v };
        saveScreenShareVolumes(next);
        return next;
      });
      applyScreenShareAudioVolume(identity, v);
    },
    [applyScreenShareAudioVolume],
  );

  const getScreenShareVolume = useCallback((identity: string) => {
    return screenShareVolumesRef.current.get(identity) ?? 100;
  }, []);

  const publishVoiceFlags = useCallback(
    async (nextMuted: boolean, nextDeafened: boolean) => {
      const channelId = channelIdRef.current;
      if (!channelId) return;
      try {
        await client.updateVoiceState(channelId, {
          muted: nextMuted,
          deafened: nextDeafened,
        });
        const guildId = guildIdRef.current;
        if (guildId) {
          client.emitVoiceState({
            guildId,
            channelId,
            muted: nextMuted,
            deafened: nextDeafened,
          });
        }
      } catch {
        // ignore
      }
    },
    [client],
  );

  const setMute = useCallback(
    async (next: boolean) => {
      const room = roomRef.current;
      const channelId = channelIdRef.current;
      if (!room || !channelId) return;
      if (afkSilenceRef.current && !next) return;
      if (mutedRef.current === next) return;
      try {
        await room.localParticipant.setMicrophoneEnabled(!next);
      } catch {
        // ignore
      }
      mutedRef.current = next;
      setMuted(next);
      refreshParticipants(room, next);
      await publishVoiceFlags(next, deafenedRef.current);
    },
    [publishVoiceFlags, refreshParticipants],
  );

  const setDeafen = useCallback(
    async (next: boolean) => {
      const room = roomRef.current;
      const channelId = channelIdRef.current;
      if (!room || !channelId) return;
      if (afkSilenceRef.current && !next) return;

      const prevMuted = mutedRef.current;
      const deafenChanged = deafenedRef.current !== next;
      deafenedRef.current = next;
      ensureRemoteAudioReceiving(room, next || afkSilenceRef.current);

      // Kulaklık mute ↔ mikrofon birlikte
      let nextMuted = mutedRef.current;
      if (next) {
        if (!mutedRef.current) {
          try {
            await room.localParticipant.setMicrophoneEnabled(false);
          } catch {
            // ignore
          }
          nextMuted = true;
          mutedRef.current = true;
          setMuted(true);
        }
      } else if (!afkSilenceRef.current) {
        if (mutedRef.current) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch {
            // ignore
          }
          nextMuted = false;
          mutedRef.current = false;
          setMuted(false);
        }
      }

      if (!deafenChanged && nextMuted === prevMuted) return;

      setDeafened(next);
      refreshParticipants(room, nextMuted);
      await publishVoiceFlags(nextMuted, next);
    },
    [publishVoiceFlags, refreshParticipants],
  );

  const setAfkSilence = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        if (!afkSilenceRef.current) return;
        afkSilenceRef.current = false;
        const room = roomRef.current;
        if (room) ensureRemoteAudioReceiving(room, false);
        void (async () => {
          await setDeafen(false);
          await setMute(false);
        })();
        return;
      }
      afkSilenceRef.current = true;
      void (async () => {
        await setMute(true);
        await setDeafen(true);
      })();
    },
    [setMute, setDeafen],
  );

  const toggleMute = useCallback(async () => {
    if (afkSilenceRef.current) return;
    await setMute(!mutedRef.current);
  }, [setMute]);

  const toggleDeafen = useCallback(async () => {
    if (afkSilenceRef.current) return;
    await setDeafen(!deafenedRef.current);
  }, [setDeafen]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    const channelId = channelIdRef.current;
    if (!room) return;
    setError(null);

    const syncSharePresence = (sharing: boolean) => {
      if (!channelId) return;
      void client
        .updateVoiceState(channelId, { screenSharing: sharing })
        .catch(() => undefined);
      const gid = guildIdRef.current;
      if (gid) {
        client.emitVoiceState({
          guildId: gid,
          channelId,
          screenSharing: sharing,
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
      }
    };

    const shareCaptureOpts = (withAudio: boolean) =>
      ({
        audio: withAudio,
        resolution: { width: 1920, height: 1080, frameRate: 30 },
        contentHint: 'detail' as const,
      }) as const;

    const sharePublishOpts = {
      simulcast: false,
      screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 30 },
    };

    if (screenSharing) {
      // Paylaşımı güvenli kapat — mic/oda bağlantısına dokunma
      try {
        const pubs = [
          ...room.localParticipant.trackPublications.values(),
        ].filter(
          (p) =>
            p.source === Track.Source.ScreenShare ||
            p.source === Track.Source.ScreenShareAudio,
        );
        for (const pub of pubs) {
          const track = pub.track;
          if (!track) continue;
          try {
            await room.localParticipant.unpublishTrack(track, true);
          } catch {
            // ignore per-track
          }
          try {
            track.stop();
          } catch {
            // ignore
          }
        }
        try {
          await room.localParticipant.setScreenShareEnabled(false);
        } catch {
          // ignore — track’ler zaten kaldırılmış olabilir
        }
      } catch (err) {
        // Soft fail: oda ayakta kalsın
        console.warn('[voice] screen share stop', err);
      }
      setScreenSharing(false);
      syncSharePresence(false);
      if (focusedScreenShareIdRef.current === room.localParticipant.identity) {
        focusedScreenShareIdRef.current = null;
      }
      try {
        applyScreenShareView(room);
        refreshParticipants(room, mutedRef.current);
      } catch {
        // ignore
      }
      return;
    }

    try {
      try {
        await room.localParticipant.setScreenShareEnabled(
          true,
          shareCaptureOpts(true),
          sharePublishOpts,
        );
      } catch (audioErr) {
        // Windows/Chrome’da sistem sesi sık fail eder — video-only ile devam
        if (!isScreenShareAudioFailure(audioErr)) throw audioErr;
        try {
          await room.localParticipant.setScreenShareEnabled(false);
        } catch {
          // ignore
        }
        await room.localParticipant.setScreenShareEnabled(
          true,
          shareCaptureOpts(false),
          sharePublishOpts,
        );
      }
      setScreenSharing(true);
      syncSharePresence(true);
      focusedScreenShareIdRef.current = room.localParticipant.identity;
      applyScreenShareView(room);
      refreshParticipants(room, mutedRef.current);
    } catch (err) {
      setScreenSharing(false);
      syncSharePresence(false);
      setError(screenShareErrorMessage(err));
      try {
        await room.localParticipant.setScreenShareEnabled(false);
      } catch {
        // ignore
      }
      // Mic’i yeniden doğrula — paylaşım hatası odayı düşürmesin
      try {
        if (!mutedRef.current && !deafenedRef.current) {
          await room.localParticipant.setMicrophoneEnabled(true);
        }
      } catch {
        // ignore
      }
    }
  }, [screenSharing, refreshParticipants, applyScreenShareView, client]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    setError(null);
    const next = !cameraEnabled;
    try {
      const opts = audioSettingsRef.current.videoDeviceId
        ? { deviceId: audioSettingsRef.current.videoDeviceId }
        : undefined;
      await room.localParticipant.setCameraEnabled(next, opts);
      setCameraEnabled(next);
      syncCameraTracks(room);
      refreshParticipants(room, mutedRef.current);
      void refreshAudioDevices();
    } catch (err) {
      setCameraEnabled(false);
      setError(cameraErrorMessage(err));
      try {
        await room.localParticipant.setCameraEnabled(false);
      } catch {
        // ignore
      }
    }
  }, [cameraEnabled, refreshParticipants, syncCameraTracks, refreshAudioDevices]);

  const setVideoDevice = useCallback(
    async (deviceId: string) => {
      const next = { ...audioSettingsRef.current, videoDeviceId: deviceId };
      persistAudio(next);
      const room = roomRef.current;
      if (!room) return;
      try {
        if (deviceId) {
          await room.switchActiveDevice('videoinput', deviceId);
        } else {
          const devices = await Room.getLocalDevices('videoinput', false);
          const fallback = devices.find((d) => d.deviceId && d.deviceId !== 'default') ?? devices[0];
          if (fallback?.deviceId) {
            await room.switchActiveDevice('videoinput', fallback.deviceId);
          }
        }
        if (cameraEnabled) {
          syncCameraTracks(room);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kamera aygıtı değiştirilemedi');
      }
    },
    [persistAudio, cameraEnabled, syncCameraTracks],
  );

  const setInputDevice = useCallback(
    async (deviceId: string) => {
      const next = { ...audioSettingsRef.current, inputDeviceId: deviceId };
      persistAudio(next);
      const room = roomRef.current;
      if (!room) return;
      try {
        if (deviceId) {
          await room.switchActiveDevice('audioinput', deviceId);
        }
        // boş = tarayıcı / sistem varsayılanı — listedeki ilk cihaza zorlama
        const mic = getMicTrack(room);
        if (mic && !deepFilterActiveRef.current) {
          micGainRef.current = null;
          await applyMicGainToTrack(mic, next.micVolume).catch(() => undefined);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Giriş aygıtı değiştirilemedi');
      }
    },
    [persistAudio, applyMicGainToTrack],
  );

  const setOutputDevice = useCallback(
    async (deviceId: string) => {
      const next = { ...audioSettingsRef.current, outputDeviceId: deviceId };
      persistAudio(next);
      const room = roomRef.current;
      if (!room) return;
      try {
        if (deviceId) {
          await room.switchActiveDevice('audiooutput', deviceId);
        }
        // boş = sistem varsayılanı
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Çıkış aygıtı değiştirilemedi');
      }
    },
    [persistAudio],
  );

  const setMicVolume = useCallback(
    (volume: number) => {
      const micVolume = clampVol(volume);
      const next = { ...audioSettingsRef.current, micVolume };
      persistAudio(next);
      const room = roomRef.current;
      const mic = room ? getMicTrack(room) : undefined;
      if (mic) {
        void applyMicGainToTrack(mic, micVolume).catch(() => undefined);
      }
    },
    [persistAudio, applyMicGainToTrack],
  );

  const setOutputVolume = useCallback(
    (volume: number) => {
      const outputVolume = clampVol(volume);
      const next = { ...audioSettingsRef.current, outputVolume };
      persistAudio(next);
      const room = roomRef.current;
      if (room) {
        applyOutputVolume(
          room,
          outputVolume,
          participantVolumesRef.current,
          screenShareVolumesRef.current,
        );
      }
    },
    [persistAudio],
  );

  const applyAudioBitrateToRoom = useCallback(
    async (room: Room, kbps: VoiceBitrateKbps) => {
      const publish = voiceAudioPublishOptions(kbps);
      room.options.publishDefaults = {
        ...room.options.publishDefaults,
        ...publish,
      };
      const mic = getMicTrack(room);
      if (!mic) return;
      const wasMuted = mutedRef.current;
      await room.localParticipant.unpublishTrack(mic, false);
      await room.localParticipant.publishTrack(mic, publish);
      if (wasMuted) {
        await room.localParticipant.setMicrophoneEnabled(false);
      }
      await applyMicGainToTrack(mic, audioSettingsRef.current.micVolume).catch(() => undefined);
    },
    [applyMicGainToTrack],
  );

  const setAudioBitrate = useCallback(
    async (kbps: VoiceBitrateKbps) => {
      const audioBitrateKbps = normalizeBitrateKbps(kbps);
      const next = { ...audioSettingsRef.current, audioBitrateKbps };
      persistAudio(next);
      const room = roomRef.current;
      if (!room) return;
      try {
        await applyAudioBitrateToRoom(room, audioBitrateKbps);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ses kalitesi uygulanamadı');
      }
    },
    [persistAudio, applyAudioBitrateToRoom],
  );

  const toggleNoiseCancellation = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const mic = getMicTrack(room);
    if (!mic) {
      setNoiseNote('Mikrofon henüz hazır değil; ses kanalına bağlandıktan sonra dene.');
      return;
    }

    const next = !noiseCancellation;
    const micVolume = audioSettingsRef.current.micVolume;

    if (next) {
      try {
        const { VoiceClarityProcessor, isVoiceClaritySupported } = await import(
          'denoise-voice-clarity'
        );
        if (!isVoiceClaritySupported()) throw new Error('unsupported');

        try {
          await mic.stopProcessor();
        } catch {
          // ignore
        }
        micGainRef.current = null;

        await mic.restartTrack({
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          deviceId: audioSettingsRef.current.inputDeviceId || undefined,
        });

        const processor = new VoiceClarityProcessor({
          enabled: true,
          presenceGainDb: micVolumeToPresenceDb(micVolume),
          attenuationLimitDb: 30,
        });
        await mic.setProcessor(processor);
        deepFilterActiveRef.current = true;
        clarityRef.current = processor;
        setNoiseCancellation(true);
        setNoiseNote('DeepFilterNet etkin — arka plan gürültüsü azaltılıyor.');
      } catch (err) {
        deepFilterActiveRef.current = false;
        clarityRef.current = null;
        setNoiseCancellation(false);
        setNoiseNote(
          err instanceof Error && err.message === 'unsupported'
            ? 'Bu tarayıcı DeepFilterNet desteklemiyor; tarayıcı gürültü engelleme kullanılıyor.'
            : 'DeepFilterNet yüklenemedi; tarayıcı gürültü engelleme kullanılıyor.',
        );
        await mic.restartTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: audioSettingsRef.current.inputDeviceId || undefined,
        });
        await applyMicGainToTrack(mic, micVolume).catch(() => undefined);
      }
      return;
    }

    try {
      if (deepFilterActiveRef.current) await mic.stopProcessor();
    } catch {
      // ignore
    }
    deepFilterActiveRef.current = false;
    clarityRef.current = null;
    micGainRef.current = null;
    setNoiseCancellation(false);
    setNoiseNote('Gürültü engelleme kapalı.');
    await mic.restartTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      deviceId: audioSettingsRef.current.inputDeviceId || undefined,
    });
    await applyMicGainToTrack(mic, micVolume).catch(() => undefined);
  }, [noiseCancellation, applyMicGainToTrack]);

  const value = useMemo<VoiceSessionValue>(
    () => ({
      voiceChannelId,
      voiceGuildId,
      connected,
      isVoiceLeader,
      voiceOnOtherTab,
      latencyMs,
      muted,
      deafened,
      cameraEnabled,
      screenSharing,
      activeScreenShare,
      availableScreenShares,
      screenShareViewPaused,
      focusScreenShare,
      pauseScreenShareView,
      resumeScreenShareView,
      setScreenVideoElement,
      setCameraVideoElement,
      participants,
      participantVolumes,
      screenShareVolumes,
      error,
      audioPlaybackBlocked,
      unlockAudio,
      noiseCancellation,
      noiseNote,
      audioSettings,
      audioInputDevices,
      audioOutputDevices,
      videoInputDevices,
      refreshAudioDevices,
      setInputDevice,
      setOutputDevice,
      setVideoDevice,
      setMicVolume,
      setOutputVolume,
      setAudioBitrate,
      setParticipantVolume,
      getParticipantVolume,
      toggleLocalMuteParticipant,
      isLocalMutedParticipant,
      setScreenShareVolume,
      getScreenShareVolume,
      join,
      prepareMicrophone,
      leave,
      toggleMute,
      toggleDeafen,
      setMute,
      setDeafen,
      setAfkSilence,
      toggleCamera,
      toggleScreenShare,
      toggleNoiseCancellation,
    }),
    [
      voiceChannelId,
      voiceGuildId,
      connected,
      isVoiceLeader,
      voiceOnOtherTab,
      latencyMs,
      muted,
      deafened,
      cameraEnabled,
      screenSharing,
      activeScreenShare,
      availableScreenShares,
      screenShareViewPaused,
      focusScreenShare,
      pauseScreenShareView,
      resumeScreenShareView,
      setScreenVideoElement,
      setCameraVideoElement,
      participants,
      participantVolumes,
      screenShareVolumes,
      error,
      audioPlaybackBlocked,
      unlockAudio,
      noiseCancellation,
      noiseNote,
      audioSettings,
      audioInputDevices,
      audioOutputDevices,
      videoInputDevices,
      refreshAudioDevices,
      setInputDevice,
      setOutputDevice,
      setVideoDevice,
      setMicVolume,
      setOutputVolume,
      setAudioBitrate,
      setParticipantVolume,
      getParticipantVolume,
      toggleLocalMuteParticipant,
      isLocalMutedParticipant,
      setScreenShareVolume,
      getScreenShareVolume,
      join,
      prepareMicrophone,
      leave,
      toggleMute,
      toggleDeafen,
      setMute,
      setDeafen,
      setAfkSilence,
      toggleCamera,
      toggleScreenShare,
      toggleNoiseCancellation,
    ],
  );

  return (
    <VoiceSessionContext.Provider value={value}>{children}</VoiceSessionContext.Provider>
  );
}

export function useVoiceSession(): VoiceSessionValue {
  const ctx = useContext(VoiceSessionContext);
  if (!ctx) {
    throw new Error('useVoiceSession VoiceSessionProvider içinde kullanılmalı');
  }
  return ctx;
}

/** @deprecated use useVoiceSession */
export function useVoiceRoom(channelId: string | undefined, guildId?: string) {
  const voice = useVoiceSession();
  useEffect(() => {
    if (channelId && guildId) {
      voice.join(channelId, guildId);
    }
  }, [channelId, guildId, voice]);
  return voice;
}
