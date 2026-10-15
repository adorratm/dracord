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
import {
  LocalTrack,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import type { VoiceParticipant } from '@dracord/ui';
import { API_URL } from '../config';
import {
  loadVoiceAudioSettings,
  normalizeBitrateKbps,
  normalizeScreenShareFps,
  normalizeScreenShareResolution,
  normalizeScreenShareViewQuality,
  saveVoiceAudioSettings,
  screenShareCaptureResolution,
  SCREEN_SHARE_VIEW_QUALITY_SPECS,
  softVolumeCurve,
  type ScreenShareFps,
  type ScreenShareResolutionId,
  type ScreenShareViewQualityId,
  type VoiceAudioSettings,
  type VoiceBitrateKbps,
} from '@/lib/voice-settings';
import {
  loadParticipantVolumes,
  loadScreenShareVolumes,
  saveParticipantVolumes,
  saveScreenShareVolumes,
} from '@/lib/participant-volumes';
import {
  NSFW_RESHARE_COOLDOWN_MS,
  NSFW_SAMPLE_INTERVAL_MS,
  nsfwBlockMessage,
  startNsfwTrackMonitor,
  type NsfwMonitorHandle,
} from '@/lib/nsfw-screen-guard';
import {
  applyRemoteScreenShareViewQuality,
  clearScreenShareQualityFloor,
  isScreenShareAudioFailure,
  listenLevel,
  screenShareErrorMessage,
  screenShareSimulcastLayersForHeight,
  setRemoteSourceVolume,
  type ActiveScreenShare,
} from '../lib/screen-share';
import {
  ScreenSharePicker,
  type DesktopCaptureSource,
  type ScreenShareSelection,
} from '../components/ScreenSharePicker';
import { playUiTone } from '@/lib/sounds';
import { SocketEvents } from '@dracord/sdk';
import type { VoiceTakeoverPayload } from '@dracord/types';
import { useAuth } from '../auth';

type AudioDevice = { deviceId: string; label: string };

const NO_CAMERA_MSG =
  'Kamera bulunamadı. Bağlı bir webcam veya telefon kamerası olduğundan emin ol.';

async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await Room.getLocalDevices('videoinput', false);
    return devices.filter((d) => Boolean(d.deviceId));
  } catch {
    /* fall through */
  }
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput' && Boolean(d.deviceId));
  } catch {
    return [];
  }
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (
    name === 'NotAllowedError' ||
    /permission denied|notallowed|denied by user/i.test(msg)
  ) {
    return 'Kamera izni reddedildi. Sistem ayarlarından kamera erişimine izin ver.';
  }
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    /not found|requested device not found|no.*device/i.test(msg)
  ) {
    return NO_CAMERA_MSG;
  }
  if (name === 'NotReadableError' || /could not start|in use/i.test(msg)) {
    return 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
  }
  return msg || 'Kamera açılamadı';
}

/** Publisher PeerConnection üzerinden anlık RTT (ms) — medya yolu öncelikli. */
async function readPublisherRttMs(room: Room): Promise<number | null> {
  const samples: number[] = [];
  const push = (ms: number | undefined) => {
    if (ms != null && Number.isFinite(ms) && ms >= 0 && ms < 5000) {
      samples.push(ms);
    }
  };
  try {
    for (const pub of room.localParticipant.trackPublications.values()) {
      const track = pub.track;
      if (!(track instanceof LocalTrack) || !track.sender) continue;
      const report = await track.sender.getStats();
      report.forEach((stat) => {
        if (stat.type === 'remote-inbound-rtp') {
          const rtt = (stat as { roundTripTime?: number }).roundTripTime;
          if (typeof rtt === 'number') push(rtt * 1000);
        }
        if (stat.type === 'candidate-pair') {
          const pair = stat as RTCIceCandidatePairStats & {
            selected?: boolean;
            state?: string;
          };
          const active =
            pair.state === 'succeeded' && (pair.nominated || pair.selected);
          if (active && typeof pair.currentRoundTripTime === 'number') {
            push(pair.currentRoundTripTime * 1000);
          }
        }
      });
    }
    if (samples.length === 0) {
      const engine = (
        room as unknown as {
          engine?: {
            pcManager?: {
              publisher?: { getStats?: () => Promise<RTCStatsReport> };
            };
          };
        }
      ).engine;
      const pcStats = await engine?.pcManager?.publisher?.getStats?.();
      pcStats?.forEach((stat) => {
        if (stat.type === 'remote-inbound-rtp') {
          const rtt = (stat as { roundTripTime?: number }).roundTripTime;
          if (typeof rtt === 'number') push(rtt * 1000);
        }
        if (stat.type === 'candidate-pair') {
          const pair = stat as RTCIceCandidatePairStats & {
            selected?: boolean;
            state?: string;
          };
          if (
            pair.state === 'succeeded' &&
            (pair.nominated || pair.selected) &&
            typeof pair.currentRoundTripTime === 'number'
          ) {
            push(pair.currentRoundTripTime * 1000);
          }
        }
      });
    }
  } catch {
    // ignore
  }
  if (!samples.length) return null;
  return Math.max(1, Math.round(Math.min(...samples)));
}

type VoiceSessionApi = {
  voiceChannelId: string | null;
  voiceGuildId: string | null;
  voiceChannelName: string | null;
  connected: boolean;
  /** WebRTC RTT (ping), ms */
  latencyMs: number | null;
  /** API/sunucu HTTP RTT, ms */
  serverLatencyMs: number | null;
  status: string | null;
  muted: boolean;
  deafened: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  noiseCancellation: boolean;
  peers: VoiceParticipant[];
  /** Web MusicPlayerBar uyumu — peers ile aynı */
  participants: VoiceParticipant[];
  screenShares: ActiveScreenShare[];
  activeScreenShare: ActiveScreenShare | null;
  screenShareViewPaused: boolean;
  screenShareVolumes: Record<string, number>;
  participantVolumes: Record<string, number>;
  audioSettings: VoiceAudioSettings;
  audioInputDevices: AudioDevice[];
  audioOutputDevices: AudioDevice[];
  videoDevices: AudioDevice[];
  room: Room | null;
  /** Ses web/mobilde; bu istemci LiveKit dinlemiyor */
  voiceOnOtherClient: boolean;
  voiceElsewherePlatform: string | null;
  reclaimVoice: () => Promise<void>;
  join: (
    guildId: string,
    channel: { id: string; name: string; type?: string },
    opts?: { password?: string },
  ) => Promise<void>;
  leave: () => Promise<string | null>;
  setMuted: (v: boolean) => void;
  setDeafened: (v: boolean) => void;
  /** AFK kanalı: zorla mute+deafen, konuşma göstergesi kapalı, kimse duyulmaz */
  setAfkSilence: (enabled: boolean) => void;
  /** Bağlı ses kanalının tipi (AFK zamanlayıcı için) */
  voiceChannelType: string | null;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleNoiseCancellation: () => void;
  focusScreenShare: (identity: string) => void;
  pauseScreenShareView: () => void;
  resumeScreenShareView: () => void;
  setScreenVideoElement: (el: HTMLVideoElement | null) => void;
  setScreenShareVolume: (identity: string, volume: number) => void;
  setParticipantVolume: (identity: string, volume: number) => void;
  getParticipantVolume: (identity: string) => number;
  isLocalMutedParticipant: (identity: string) => boolean;
  toggleLocalMuteParticipant: (identity: string) => void;
  setMicVolume: (v: number) => void;
  setOutputVolume: (v: number) => void;
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  setVideoDevice: (deviceId: string) => Promise<void>;
  setAudioBitrate: (kbps: VoiceBitrateKbps) => void;
  refreshAudioDevices: (force?: boolean) => Promise<void>;
  setScreenShareResolution: (id: ScreenShareResolutionId) => Promise<void>;
  setScreenShareFps: (fps: ScreenShareFps) => Promise<void>;
  setScreenShareViewQuality: (id: ScreenShareViewQualityId) => void;
  setNsfwContentFilter: (enabled: boolean) => void;
  attachCamera: (identity: string, el: HTMLVideoElement | null) => void;
};

const Ctx = createContext<VoiceSessionApi | null>(null);

export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const { client, user } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const attached = useRef<HTMLMediaElement[]>([]);
  const cameraEls = useRef<Map<string, HTMLVideoElement>>(new Map());
  const joinGen = useRef(0);
  const knownPeersRef = useRef(new Set<string>());
  const intentionalLeaveRef = useRef(false);
  const voiceChannelIdRef = useRef<string | null>(null);
  const voiceGuildIdRef = useRef<string | null>(null);
  const screenVideoElRef = useRef<HTMLVideoElement | null>(null);
  const focusedShareIdRef = useRef<string | null>(null);
  /** Bağlı ekran paylaşımı kimliği — gereksiz re-attach önlemek için */
  const activeScreenShareIdRef = useRef<string | null>(null);
  const viewPausedRef = useRef(false);
  const screenSharingRef = useRef(false);
  const audioSettingsRef = useRef(loadVoiceAudioSettings());
  const screenShareVolumesRef = useRef(loadScreenShareVolumes());
  const participantVolumesRef = useRef(loadParticipantVolumes());
  const preMuteVolumesRef = useRef(new Map<string, number>());
  const nsfwShareMonitorRef = useRef<NsfwMonitorHandle | null>(null);
  const nsfwCooldownUntilRef = useRef(0);
  const boundShareTrackRef = useRef<Track | null>(null);
  const noiseCancellationRef = useRef(false);
  const afkSilenceRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const voiceChannelTypeRef = useRef<string | null>(null);
  const pickerResolveRef = useRef<((sel: ScreenShareSelection | null) => void) | null>(
    null,
  );

  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [voiceGuildId, setVoiceGuildId] = useState<string | null>(null);
  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null);
  const [voiceChannelType, setVoiceChannelType] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSources, setPickerSources] = useState<DesktopCaptureSource[]>([]);
  const [connected, setConnected] = useState(false);
  const [voiceOnOtherClient, setVoiceOnOtherClient] = useState(false);
  const [voiceElsewherePlatform, setVoiceElsewherePlatform] = useState<string | null>(
    null,
  );
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [serverLatencyMs, setServerLatencyMs] = useState<number | null>(null);
  const yieldingRef = useRef(false);

  useEffect(() => {
    client.setVoiceClient(client.getVoiceClientId(), 'desktop');
  }, [client]);
  const [status, setStatus] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [deafened, setDeafenedState] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [peers, setPeers] = useState<VoiceParticipant[]>([]);
  const [screenShares, setScreenShares] = useState<ActiveScreenShare[]>([]);
  const [activeScreenShare, setActiveScreenShare] = useState<ActiveScreenShare | null>(null);
  const [screenShareViewPaused, setScreenShareViewPaused] = useState(false);
  const [screenShareVolumes, setScreenShareVolumes] = useState(loadScreenShareVolumes);
  const [participantVolumes, setParticipantVolumes] = useState(loadParticipantVolumes);
  const [audioSettings, setAudioSettings] = useState(loadVoiceAudioSettings);
  const [noiseCancellation, setNoiseCancellation] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<AudioDevice[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioDevice[]>([]);
  const [videoDevices, setVideoDevices] = useState<AudioDevice[]>([]);

  const userId = user?.id;
  const displayName = user?.displayName;

  voiceChannelIdRef.current = voiceChannelId;
  voiceGuildIdRef.current = voiceGuildId;

  const closeScreenSharePicker = useCallback((selection: ScreenShareSelection | null) => {
    setPickerOpen(false);
    setPickerLoading(false);
    setPickerSources([]);
    const resolve = pickerResolveRef.current;
    pickerResolveRef.current = null;
    resolve?.(selection);
  }, []);

  const pickScreenShareSource = useCallback(async (): Promise<ScreenShareSelection | null> => {
    const desktop = window.dracordDesktop;
    if (!desktop?.getDesktopSources || !desktop.setDisplayMediaSelection) {
      // Tarayıcı / native getDisplayMedia
      return { sourceId: '', systemAudio: true };
    }
    setPickerLoading(true);
    setPickerOpen(true);
    try {
      const sources = await desktop.getDesktopSources();
      setPickerSources(sources);
      setPickerLoading(false);
      return await new Promise<ScreenShareSelection | null>((resolve) => {
        pickerResolveRef.current = resolve;
      });
    } catch (err) {
      setPickerOpen(false);
      setPickerLoading(false);
      setStatus(err instanceof Error ? err.message : 'Ekran kaynakları alınamadı');
      return null;
    }
  }, []);

  const applyShareAudioVolumes = useCallback((room: Room) => {
    const out = audioSettingsRef.current.outputVolume;
    for (const p of room.remoteParticipants.values()) {
      const sharePct = screenShareVolumesRef.current[p.identity] ?? 100;
      setRemoteSourceVolume(
        p,
        Track.Source.ScreenShareAudio,
        listenLevel(out, sharePct),
      );
    }
  }, []);

  const listScreenShares = useCallback((room: Room): ActiveScreenShare[] => {
    const shares: ActiveScreenShare[] = [];
    const localPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (localPub?.track) {
      shares.push({
        identity: room.localParticipant.identity,
        displayName: displayName ?? 'Sen',
        isLocal: true,
      });
    }
    for (const p of room.remoteParticipants.values()) {
      const pub = p.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track) {
        shares.push({
          identity: p.identity,
          displayName: p.name || p.identity,
          isLocal: false,
        });
      }
    }
    return shares;
  }, [displayName]);

  const clearScreenShareView = useCallback(() => {
    const el = screenVideoElRef.current;
    const prev = boundShareTrackRef.current;
    if (el && prev) {
      try {
        prev.detach(el);
      } catch {
        /* ignore */
      }
    }
    boundShareTrackRef.current = null;
    activeScreenShareIdRef.current = null;
    setActiveScreenShare(null);
    clearScreenShareQualityFloor();
  }, []);

  const bindScreenShareTrack = useCallback(
    (track: Track | null, share: ActiveScreenShare) => {
      const el = screenVideoElRef.current;
      const prev = boundShareTrackRef.current;
      // Aynı track + aynı kişi → yeniden attach etme (konuşma event flicker/takılma)
      if (
        track &&
        prev === track &&
        activeScreenShareIdRef.current === share.identity
      ) {
        setActiveScreenShare(share);
        return;
      }
      if (prev && prev !== track && el) {
        try {
          prev.detach(el);
        } catch {
          /* ignore */
        }
      }
      boundShareTrackRef.current = track;
      if (!track) {
        activeScreenShareIdRef.current = null;
        setActiveScreenShare(null);
        return;
      }
      activeScreenShareIdRef.current = share.identity;
      setActiveScreenShare(share);
      if (el && prev !== track) {
        track.attach(el);
        el.playsInline = true;
        el.autoplay = true;
        el.muted = share.isLocal;
        void el.play().catch(() => undefined);
      }
    },
    [],
  );

  const applyScreenShareView = useCallback(
    (room: Room) => {
      const shares = listScreenShares(room);
      setScreenShares(shares);
      const localSharing = shares.some((s) => s.isLocal);
      setScreenSharing(localSharing);
      screenSharingRef.current = localSharing;

      if (shares.length === 0) {
        focusedShareIdRef.current = null;
        viewPausedRef.current = false;
        setScreenShareViewPaused(false);
        clearScreenShareView();
        return;
      }

      let focusId = focusedShareIdRef.current;
      if (!focusId || !shares.some((s) => s.identity === focusId)) {
        if (viewPausedRef.current) {
          clearScreenShareView();
          return;
        }
        focusId = shares.find((s) => !s.isLocal)?.identity ?? shares[0]!.identity;
        focusedShareIdRef.current = focusId;
      }

      if (viewPausedRef.current) {
        clearScreenShareView();
        return;
      }

      const share = shares.find((s) => s.identity === focusId) ?? shares[0]!;
      const viewQuality = normalizeScreenShareViewQuality(
        audioSettingsRef.current.screenShareViewQuality,
      );
      let track: Track | null = null;
      if (share.isLocal) {
        track =
          room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track ?? null;
      } else {
        const p = room.remoteParticipants.get(share.identity);
        const pub = p?.getTrackPublication(Track.Source.ScreenShare) as
          | RemoteTrackPublication
          | undefined;
        track = pub?.track ?? null;
        if (pub) applyRemoteScreenShareViewQuality(pub, viewQuality, { focused: true });
      }
      for (const remote of room.remoteParticipants.values()) {
        if (remote.identity === share.identity) continue;
        const other = remote.getTrackPublication(Track.Source.ScreenShare) as
          | RemoteTrackPublication
          | undefined;
        if (other) applyRemoteScreenShareViewQuality(other, '480p', { focused: false });
      }
      bindScreenShareTrack(track, share);
      applyShareAudioVolumes(room);
    },
    [applyShareAudioVolumes, bindScreenShareTrack, clearScreenShareView, listScreenShares],
  );

  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setPeers([]);
      setScreenShares([]);
      return;
    }
    const metaOf = (raw?: string) => {
      if (!raw) return { avatarUrl: null as string | null, isBot: false };
      try {
        const parsed = JSON.parse(raw) as { avatarUrl?: string | null; isBot?: boolean };
        return {
          avatarUrl: parsed.avatarUrl ?? null,
          isBot: Boolean(parsed.isBot),
        };
      } catch {
        return { avatarUrl: null, isBot: false };
      }
    };
    const afk = afkSilenceRef.current;
    const list: VoiceParticipant[] = [];
    if (displayName && userId) {
      list.push({
        id: userId,
        displayName,
        avatarUrl: user?.avatarUrl,
        speaking: afk ? false : room.localParticipant.isSpeaking,
        muted: afk ? true : mutedRef.current,
        camera: cameraEnabled,
        video: screenSharingRef.current,
        isBot: false,
      });
    }
    for (const p of room.remoteParticipants.values()) {
      const cams = Array.from(p.trackPublications.values()).some(
        (pub) =>
          pub.kind === Track.Kind.Video &&
          pub.source === Track.Source.Camera &&
          pub.isSubscribed,
      );
      const screens = Array.from(p.trackPublications.values()).some(
        (pub) =>
          pub.kind === Track.Kind.Video &&
          pub.source === Track.Source.ScreenShare &&
          pub.isSubscribed,
      );
      const meta = metaOf(p.metadata);
      const isBot =
        meta.isBot ||
        p.identity === DRACORD_BOT_USER_ID ||
        p.identity === 'system-dracord-bot';
      list.push({
        id: p.identity,
        displayName: p.name || p.identity,
        avatarUrl: meta.avatarUrl,
        speaking: afk ? false : p.isSpeaking,
        muted: afk ? true : p.isMicrophoneEnabled === false,
        camera: cams,
        video: screens,
        isBot,
      });
    }
    setPeers(list);
    applyScreenShareView(room);
  }, [applyScreenShareView, cameraEnabled, displayName, user?.avatarUrl, userId]);

  /** Yalnız peer listesi — ekran track’ine dokunma (ActiveSpeakersChanged) */
  const refreshPeers = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setPeers([]);
      return;
    }
    const metaOf = (raw?: string) => {
      if (!raw) return { avatarUrl: null as string | null, isBot: false };
      try {
        const parsed = JSON.parse(raw) as { avatarUrl?: string | null; isBot?: boolean };
        return {
          avatarUrl: parsed.avatarUrl ?? null,
          isBot: Boolean(parsed.isBot),
        };
      } catch {
        return { avatarUrl: null, isBot: false };
      }
    };
    const afk = afkSilenceRef.current;
    const list: VoiceParticipant[] = [];
    if (displayName && userId) {
      list.push({
        id: userId,
        displayName,
        avatarUrl: user?.avatarUrl,
        speaking: afk ? false : room.localParticipant.isSpeaking,
        muted: afk ? true : mutedRef.current,
        camera: cameraEnabled,
        video: screenSharingRef.current,
        isBot: false,
      });
    }
    for (const p of room.remoteParticipants.values()) {
      const cams = Array.from(p.trackPublications.values()).some(
        (pub) =>
          pub.kind === Track.Kind.Video &&
          pub.source === Track.Source.Camera &&
          pub.isSubscribed,
      );
      const screens = Array.from(p.trackPublications.values()).some(
        (pub) =>
          pub.kind === Track.Kind.Video &&
          pub.source === Track.Source.ScreenShare &&
          pub.isSubscribed,
      );
      const meta = metaOf(p.metadata);
      const isBot =
        meta.isBot ||
        p.identity === DRACORD_BOT_USER_ID ||
        p.identity === 'system-dracord-bot';
      list.push({
        id: p.identity,
        displayName: p.name || p.identity,
        avatarUrl: meta.avatarUrl,
        speaking: afk ? false : p.isSpeaking,
        muted: afk ? true : p.isMicrophoneEnabled === false,
        camera: cams,
        video: screens,
        isBot,
      });
    }
    setPeers(list);
  }, [cameraEnabled, displayName, user?.avatarUrl, userId]);

  const stopNsfwMonitor = useCallback(() => {
    nsfwShareMonitorRef.current?.stop();
    nsfwShareMonitorRef.current = null;
  }, []);

  const syncSharePresence = useCallback(
    (sharing: boolean) => {
      if (!voiceChannelId) return;
      void client.updateVoiceState(voiceChannelId, { screenSharing: sharing }).catch(() => undefined);
    },
    [client, voiceChannelId],
  );

  const stopLocalScreenShare = useCallback(
    async (opts?: { nsfw?: boolean }) => {
      const room = roomRef.current;
      stopNsfwMonitor();
      if (!room) {
        screenSharingRef.current = false;
        setScreenSharing(false);
        return;
      }
      try {
        const pubs = [...room.localParticipant.trackPublications.values()].filter(
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
            /* ignore */
          }
          try {
            track.stop();
          } catch {
            /* ignore */
          }
        }
        try {
          await room.localParticipant.setScreenShareEnabled(false);
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
      screenSharingRef.current = false;
      setScreenSharing(false);
      syncSharePresence(false);
      if (focusedShareIdRef.current === room.localParticipant.identity) {
        focusedShareIdRef.current = null;
      }
      if (opts?.nsfw) {
        nsfwCooldownUntilRef.current = Date.now() + NSFW_RESHARE_COOLDOWN_MS;
        setStatus(nsfwBlockMessage('screen'));
      }
      applyScreenShareView(room);
      refresh();
    },
    [applyScreenShareView, refresh, stopNsfwMonitor, syncSharePresence],
  );

  const startLocalScreenShareNsfwGuard = useCallback(
    (room: Room) => {
      stopNsfwMonitor();
      if (!audioSettingsRef.current.nsfwContentFilter) return;
      nsfwShareMonitorRef.current = startNsfwTrackMonitor({
        // Desktop’ta TF.js encode ile CPU yarışmasın
        intervalMs: Math.max(NSFW_SAMPLE_INTERVAL_MS, 2500),
        getTrack: () => {
          const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
          return pub?.track?.mediaStreamTrack ?? null;
        },
        onBlocked: () => {
          void stopLocalScreenShare({ nsfw: true });
        },
      });
    },
    [stopLocalScreenShare, stopNsfwMonitor],
  );

  const teardownRoom = useCallback(
    async (
      channelId: string | null,
      guildId?: string | null,
      opts?: { playLeaveTone?: boolean; leavePresence?: boolean },
    ) => {
      const leavePresence = opts?.leavePresence !== false;
      intentionalLeaveRef.current = true;
      stopNsfwMonitor();
      clearScreenShareView();
      const room = roomRef.current;
      roomRef.current = null;
      for (const el of attached.current) {
        el.pause();
        el.srcObject = null;
        el.remove();
      }
      attached.current = [];
      cameraEls.current.clear();
      if (room) {
        room.removeAllListeners();
        try {
          await room.disconnect();
        } catch {
          /* ignore */
        }
      }
      if (channelId && leavePresence) {
        try {
          await client.leaveVoiceState(channelId);
        } catch {
          /* ignore */
        }
        const gid = guildId ?? voiceGuildIdRef.current;
        if (gid) {
          try {
            client.emitVoiceState({ guildId: gid, channelId: null });
          } catch {
            /* ignore */
          }
        }
        if (opts?.playLeaveTone) {
          playUiTone('leave');
        }
      }
      knownPeersRef.current.clear();
      intentionalLeaveRef.current = false;
      if (leavePresence) {
        afkSilenceRef.current = false;
        voiceChannelTypeRef.current = null;
        setVoiceChannelType(null);
      }
      setConnected(false);
      setCameraEnabled(false);
      setScreenSharing(false);
      screenSharingRef.current = false;
      setPeers([]);
      setScreenShares([]);
      setActiveScreenShare(null);
      focusedShareIdRef.current = null;
      viewPausedRef.current = false;
      setScreenShareViewPaused(false);
    },
    [client, clearScreenShareView, stopNsfwMonitor],
  );

  const yieldToOtherClient = useCallback(
    async (platform?: string | null) => {
      if (yieldingRef.current) return;
      yieldingRef.current = true;
      const ch = voiceChannelIdRef.current;
      try {
        await teardownRoom(ch, voiceGuildIdRef.current, {
          leavePresence: false,
          playLeaveTone: false,
        });
        setVoiceOnOtherClient(true);
        setVoiceElsewherePlatform(platform ?? null);
      } finally {
        yieldingRef.current = false;
      }
    },
    [teardownRoom],
  );

  const join = useCallback(
    async (
      guildId: string,
      channel: { id: string; name: string; type?: string },
      opts?: { password?: string },
    ) => {
      if (voiceChannelIdRef.current === channel.id && roomRef.current) {
        setVoiceGuildId(guildId);
        voiceGuildIdRef.current = guildId;
        setVoiceChannelName(channel.name);
        setVoiceOnOtherClient(false);
        setVoiceElsewherePlatform(null);
        if (channel.type) {
          voiceChannelTypeRef.current = channel.type;
          setVoiceChannelType(channel.type);
        }
        return;
      }
      const gen = ++joinGen.current;
      const prevId = voiceChannelIdRef.current;
      const prevGuild = voiceGuildIdRef.current;
      const sameChannelReclaim = prevId === channel.id && !roomRef.current;
      // Kanal değişimi / yeniden giriş: çıkış tonu (web parity)
      if (!sameChannelReclaim) {
        await teardownRoom(prevId, prevGuild, { playLeaveTone: Boolean(prevId) });
      } else {
        await teardownRoom(prevId, prevGuild, {
          leavePresence: false,
          playLeaveTone: false,
        });
      }
      afkSilenceRef.current = false;
      setVoiceOnOtherClient(false);
      setVoiceElsewherePlatform(null);

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      voiceChannelIdRef.current = channel.id;
      voiceGuildIdRef.current = guildId;
      voiceChannelTypeRef.current = channel.type ?? 'VOICE';
      setVoiceChannelId(channel.id);
      setVoiceGuildId(guildId);
      setVoiceChannelName(channel.name);
      setVoiceChannelType(channel.type ?? 'VOICE');
      setStatus(null);
      knownPeersRef.current.clear();

      const attachRemote = (
        track: RemoteTrack,
        pub: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        if (pub.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.dataset.peer = participant.identity;
          el.dataset.source = String(pub.source);
          document.body.appendChild(el);
          attached.current.push(el);
          if (deafenedRef.current || afkSilenceRef.current) el.muted = true;
          if (pub.source === Track.Source.ScreenShareAudio) {
            const sharePct = screenShareVolumesRef.current[participant.identity] ?? 100;
            try {
              (track as unknown as { setVolume?: (v: number) => void }).setVolume?.(
                listenLevel(audioSettingsRef.current.outputVolume, sharePct),
              );
            } catch {
              /* ignore */
            }
          }
        }
        refresh();
      };

      room.on(RoomEvent.ParticipantConnected, (p) => {
        if (!knownPeersRef.current.has(p.identity)) {
          knownPeersRef.current.add(p.identity);
          playUiTone('peer-join');
        }
        refresh();
      });
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        if (knownPeersRef.current.has(p.identity)) {
          knownPeersRef.current.delete(p.identity);
          if (!intentionalLeaveRef.current) {
            playUiTone('peer-leave');
          }
        }
        refresh();
      });
      room.on(RoomEvent.TrackSubscribed, attachRemote);
      room.on(RoomEvent.TrackUnsubscribed, refresh);
      // Konuşma halkası — ekran track’ini yeniden bağlama (takılma / flicker)
      room.on(RoomEvent.ActiveSpeakersChanged, refreshPeers);
      room.on(RoomEvent.LocalTrackPublished, refresh);
      room.on(RoomEvent.LocalTrackUnpublished, refresh);

      try {
        if (!sameChannelReclaim) {
          await client.joinVoiceState(channel.id, {
            muted: mutedRef.current || afkSilenceRef.current,
            deafened: deafenedRef.current || afkSilenceRef.current,
            password: opts?.password,
          });
        } else {
          await client.claimVoiceClient(channel.id).catch(() => undefined);
        }
        const tok = await client.getVoiceToken(channel.id, opts?.password);
        if (gen !== joinGen.current) return;
        await room.connect(tok.url, tok.token);
        const micOn = !mutedRef.current && !afkSilenceRef.current;
        await room.localParticipant.setMicrophoneEnabled(micOn);
        if (afkSilenceRef.current) {
          for (const el of attached.current) el.muted = true;
        }
        // Odada zaten olanlar peer-join çalmasın
        for (const p of room.remoteParticipants.values()) {
          knownPeersRef.current.add(p.identity);
        }
        playUiTone('join');
        setConnected(true);
        refresh();
      } catch (e) {
        if (gen !== joinGen.current) return;
        setStatus(e instanceof Error ? e.message : 'Ses bağlantısı başarısız');
        await teardownRoom(channel.id, guildId, { playLeaveTone: false });
        voiceChannelIdRef.current = null;
        voiceGuildIdRef.current = null;
        setVoiceChannelId(null);
        setVoiceGuildId(null);
        setVoiceChannelName(null);
      }
    },
    [client, deafened, muted, refresh, refreshPeers, teardownRoom],
  );

  const leave = useCallback(async () => {
    joinGen.current += 1;
    const id = voiceChannelIdRef.current;
    const gid = voiceGuildIdRef.current;
    voiceChannelIdRef.current = null;
    voiceGuildIdRef.current = null;
    setVoiceChannelId(null);
    setVoiceGuildId(null);
    setVoiceChannelName(null);
    setVoiceOnOtherClient(false);
    setVoiceElsewherePlatform(null);
    setStatus(null);
    await teardownRoom(id, gid, { playLeaveTone: Boolean(id) });
    return id;
  }, [teardownRoom]);

  const reclaimVoice = useCallback(async () => {
    const channelId = voiceChannelIdRef.current;
    const guildId = voiceGuildIdRef.current;
    const name = voiceChannelName;
    if (!channelId || !guildId) return;
    await join(guildId, {
      id: channelId,
      name: name ?? 'Ses',
      type: voiceChannelTypeRef.current ?? 'VOICE',
    });
  }, [join, voiceChannelName]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onTakeover = (payload: VoiceTakeoverPayload) => {
      if (!voiceChannelIdRef.current) return;
      if (payload.clientId === client.getVoiceClientId()) return;
      void yieldToOtherClient(payload.platform ?? null);
    };
    sock.on(SocketEvents.VOICE_TAKEOVER, onTakeover);
    return () => {
      sock.off(SocketEvents.VOICE_TAKEOVER, onTakeover);
    };
  }, [user, client, yieldToOtherClient]);

  const patchAudioSettings = useCallback((patch: Partial<VoiceAudioSettings>) => {
    const next = { ...audioSettingsRef.current, ...patch };
    audioSettingsRef.current = next;
    setAudioSettings(next);
    saveVoiceAudioSettings(next);
  }, []);

  const applyMicVolumes = useCallback((room: Room) => {
    const out = audioSettingsRef.current.outputVolume;
    for (const p of room.remoteParticipants.values()) {
      const micPct = participantVolumesRef.current[p.identity] ?? 100;
      setRemoteSourceVolume(p, Track.Source.Microphone, listenLevel(out, micPct));
    }
  }, []);

  const refreshAudioDevices = useCallback(async (_force?: boolean) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mikrofon (${d.deviceId.slice(0, 6)})` })),
      );
      setAudioOutputDevices(
        devices
          .filter((d) => d.kind === 'audiooutput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Hoparlör (${d.deviceId.slice(0, 6)})`,
          })),
      );
      setVideoDevices(
        devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Kamera (${d.deviceId.slice(0, 6)})` })),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const getParticipantVolume = useCallback((identity: string) => {
    return participantVolumesRef.current[identity] ?? 100;
  }, []);

  const setParticipantVolume = useCallback(
    (identity: string, volume: number) => {
      const v = Math.max(0, Math.min(100, Math.round(volume)));
      setParticipantVolumes((prev) => {
        const next = { ...prev, [identity]: v };
        participantVolumesRef.current = next;
        saveParticipantVolumes(next);
        return next;
      });
      const room = roomRef.current;
      if (!room) return;
      const p = room.remoteParticipants.get(identity);
      if (p) {
        setRemoteSourceVolume(
          p,
          Track.Source.Microphone,
          listenLevel(audioSettingsRef.current.outputVolume, v),
        );
      }
    },
    [],
  );

  const isLocalMutedParticipant = useCallback((identity: string) => {
    return (participantVolumesRef.current[identity] ?? 100) === 0;
  }, []);

  const toggleLocalMuteParticipant = useCallback(
    (identity: string) => {
      const cur = participantVolumesRef.current[identity] ?? 100;
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

  const setMicVolume = useCallback(
    (v: number) => {
      patchAudioSettings({ micVolume: Math.min(2, Math.max(0, v)) });
      void roomRef.current?.localParticipant.setMicrophoneEnabled(!muted);
    },
    [muted, patchAudioSettings],
  );

  const setOutputVolume = useCallback(
    (v: number) => {
      patchAudioSettings({ outputVolume: Math.min(2, Math.max(0, v)) });
      const room = roomRef.current;
      if (room) {
        applyMicVolumes(room);
        applyShareAudioVolumes(room);
        for (const el of attached.current) {
          try {
            el.volume = softVolumeCurve(Math.min(2, Math.max(0, v)));
          } catch {
            /* ignore */
          }
        }
      }
    },
    [applyMicVolumes, applyShareAudioVolumes, patchAudioSettings],
  );

  const setInputDevice = useCallback(
    async (deviceId: string) => {
      patchAudioSettings({ inputDeviceId: deviceId });
      const room = roomRef.current;
      if (room && deviceId) {
        try {
          await room.switchActiveDevice('audioinput', deviceId);
        } catch {
          /* ignore */
        }
      }
    },
    [patchAudioSettings],
  );

  const setOutputDevice = useCallback(
    async (deviceId: string) => {
      patchAudioSettings({ outputDeviceId: deviceId });
      const room = roomRef.current;
      if (room && deviceId) {
        try {
          await room.switchActiveDevice('audiooutput', deviceId);
        } catch {
          /* ignore */
        }
      }
    },
    [patchAudioSettings],
  );

  const setVideoDevice = useCallback(
    async (deviceId: string) => {
      patchAudioSettings({ videoDeviceId: deviceId });
      const room = roomRef.current;
      if (room && deviceId) {
        try {
          await room.switchActiveDevice('videoinput', deviceId);
        } catch {
          /* ignore */
        }
      }
    },
    [patchAudioSettings],
  );

  const setAudioBitrate = useCallback(
    (kbps: VoiceBitrateKbps) => {
      patchAudioSettings({ audioBitrateKbps: normalizeBitrateKbps(kbps) });
    },
    [patchAudioSettings],
  );

  const toggleNoiseCancellation = useCallback(() => {
    const next = !noiseCancellationRef.current;
    noiseCancellationRef.current = next;
    setNoiseCancellation(next);
  }, []);

  const setMuted = useCallback(
    (next: boolean) => {
      if (afkSilenceRef.current && !next) return;
      mutedRef.current = next;
      setMutedState(next);
      void roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
      const chId = voiceChannelIdRef.current;
      if (chId) {
        void client.updateVoiceState(chId, {
          muted: next,
          deafened: deafenedRef.current,
        });
      }
      const room = roomRef.current;
      if (room) refresh();
    },
    [client, refresh],
  );

  const setDeafened = useCallback(
    (next: boolean) => {
      if (afkSilenceRef.current && !next) return;
      deafenedRef.current = next;
      setDeafenedState(next);
      const silence = next || afkSilenceRef.current;
      for (const el of attached.current) el.muted = silence;
      let nextMuted = mutedRef.current;
      if (next) {
        nextMuted = true;
        mutedRef.current = true;
        setMutedState(true);
        void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
      } else if (!afkSilenceRef.current && mutedRef.current) {
        nextMuted = false;
        mutedRef.current = false;
        setMutedState(false);
        void roomRef.current?.localParticipant.setMicrophoneEnabled(true);
      }
      const chId = voiceChannelIdRef.current;
      if (chId) {
        void client.updateVoiceState(chId, {
          muted: nextMuted,
          deafened: next,
        });
      }
      const room = roomRef.current;
      if (room) refresh();
    },
    [client, refresh],
  );

  const setAfkSilence = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        if (!afkSilenceRef.current) return;
        afkSilenceRef.current = false;
        for (const el of attached.current) el.muted = deafenedRef.current;
        void (async () => {
          await Promise.resolve();
          setDeafened(false);
          setMuted(false);
        })();
        return;
      }
      afkSilenceRef.current = true;
      for (const el of attached.current) el.muted = true;
      void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
      mutedRef.current = true;
      deafenedRef.current = true;
      setMutedState(true);
      setDeafenedState(true);
      const chId = voiceChannelIdRef.current;
      if (chId) {
        void client.updateVoiceState(chId, { muted: true, deafened: true });
      }
      const room = roomRef.current;
      if (room) refresh();
    },
    [client, refresh, setDeafened, setMuted],
  );

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const next = !cameraEnabled;
    if (!next) {
      setStatus(null);
      setCameraEnabled(false);
      try {
        await room.localParticipant.setCameraEnabled(false);
      } catch {
        /* ignore */
      }
      void refreshAudioDevices();
      return;
    }

    const devices = await listVideoInputDevices();
    setVideoDevices(
      devices.map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Kamera (${d.deviceId.slice(0, 6)})`,
      })),
    );

    if (!devices.length) {
      setCameraEnabled(false);
      setStatus(NO_CAMERA_MSG);
      try {
        await room.localParticipant.setCameraEnabled(false);
      } catch {
        /* ignore */
      }
      return;
    }

    const preferred = audioSettingsRef.current.videoDeviceId;
    const deviceId =
      preferred && devices.some((d) => d.deviceId === preferred)
        ? preferred
        : devices[0]!.deviceId;

    try {
      setStatus(null);
      await room.localParticipant.setCameraEnabled(true, { deviceId });
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (!pub?.track) {
        await room.localParticipant.setCameraEnabled(false);
        setCameraEnabled(false);
        setStatus(NO_CAMERA_MSG);
        return;
      }
      setCameraEnabled(true);
      void refreshAudioDevices();
    } catch (err) {
      setCameraEnabled(false);
      setStatus(cameraErrorMessage(err));
      try {
        await room.localParticipant.setCameraEnabled(false);
      } catch {
        /* ignore */
      }
    }
  }, [cameraEnabled, refreshAudioDevices]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !voiceChannelIdRef.current) return;

    if (screenSharingRef.current) {
      setStatus(null);
      await stopLocalScreenShare();
      return;
    }

    if (
      audioSettingsRef.current.nsfwContentFilter &&
      Date.now() < nsfwCooldownUntilRef.current
    ) {
      const sec = Math.ceil((nsfwCooldownUntilRef.current - Date.now()) / 1000);
      setStatus(
        `Uygunsuz içerik engeli aktif — ekran paylaşımı ${sec} sn sonra tekrar denenebilir.`,
      );
      return;
    }

    setStatus(null);
    const selection = await pickScreenShareSource();
    if (!selection) return;

    const desktop = window.dracordDesktop;
    if (desktop?.setDisplayMediaSelection && selection.sourceId) {
      await desktop.setDisplayMediaSelection({
        sourceId: selection.sourceId,
        systemAudio: selection.systemAudio,
      });
    }

    const wantAudio = selection.systemAudio;
    const shareCap = screenShareCaptureResolution(audioSettingsRef.current);
    // ≥30 FPS / oyun: framerate koru; düşük FPS metin: çözünürlük
    const preferFps = shareCap.frameRate >= 30;
    const shareCaptureOpts = (withAudio: boolean) =>
      ({
        audio: withAudio,
        resolution: {
          width: shareCap.width,
          height: shareCap.height,
          frameRate: shareCap.frameRate,
        },
        contentHint: (preferFps ? 'motion' : 'detail') as 'motion' | 'detail',
      }) as const;

    const sharePublishOpts = {
      simulcast: true,
      screenShareEncoding: {
        maxBitrate: shareCap.maxBitrate,
        maxFramerate: shareCap.frameRate,
      },
      screenShareSimulcastLayers: screenShareSimulcastLayersForHeight(shareCap.height),
      degradationPreference: (preferFps
        ? 'maintain-framerate'
        : 'maintain-resolution') as 'maintain-framerate' | 'maintain-resolution',
    };

    try {
      try {
        await room.localParticipant.setScreenShareEnabled(
          true,
          shareCaptureOpts(wantAudio),
          sharePublishOpts,
        );
      } catch (audioErr) {
        if (!wantAudio || !isScreenShareAudioFailure(audioErr)) throw audioErr;
        try {
          await room.localParticipant.setScreenShareEnabled(false);
        } catch {
          /* ignore */
        }
        if (desktop?.setDisplayMediaSelection && selection.sourceId) {
          await desktop.setDisplayMediaSelection({
            sourceId: selection.sourceId,
            systemAudio: false,
          });
        }
        await room.localParticipant.setScreenShareEnabled(
          true,
          shareCaptureOpts(false),
          sharePublishOpts,
        );
      }
      setScreenSharing(true);
      screenSharingRef.current = true;
      syncSharePresence(true);
      focusedShareIdRef.current = room.localParticipant.identity;
      applyScreenShareView(room);
      refresh();
      startLocalScreenShareNsfwGuard(room);
    } catch (err) {
      setScreenSharing(false);
      screenSharingRef.current = false;
      syncSharePresence(false);
      setStatus(screenShareErrorMessage(err));
      try {
        await desktop?.clearDisplayMediaSelection?.();
      } catch {
        /* ignore */
      }
      try {
        await room.localParticipant.setScreenShareEnabled(false);
      } catch {
        /* ignore */
      }
      try {
        if (!muted) await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        /* ignore */
      }
    }
  }, [
    applyScreenShareView,
    muted,
    pickScreenShareSource,
    refresh,
    startLocalScreenShareNsfwGuard,
    stopLocalScreenShare,
    syncSharePresence,
  ]);

  const focusScreenShare = useCallback(
    (identity: string) => {
      const room = roomRef.current;
      if (!room) return;
      focusedShareIdRef.current = identity;
      applyScreenShareView(room);
    },
    [applyScreenShareView],
  );

  const pauseScreenShareView = useCallback(() => {
    const room = roomRef.current;
    const focus =
      focusedShareIdRef.current && focusedShareIdRef.current !== '__none__'
        ? focusedShareIdRef.current
        : activeScreenShare?.identity ?? null;
    if (focus) focusedShareIdRef.current = focus;
    viewPausedRef.current = true;
    setScreenShareViewPaused(true);
    clearScreenShareView();
    if (room) applyScreenShareView(room);
  }, [activeScreenShare?.identity, applyScreenShareView, clearScreenShareView]);

  const resumeScreenShareView = useCallback(() => {
    const room = roomRef.current;
    viewPausedRef.current = false;
    setScreenShareViewPaused(false);
    if (!room) return;
    const shares = listScreenShares(room);
    if (shares.length === 0) return;
    if (
      !focusedShareIdRef.current ||
      !shares.some((s) => s.identity === focusedShareIdRef.current)
    ) {
      focusedShareIdRef.current =
        shares.find((s) => !s.isLocal)?.identity ?? shares[0]!.identity;
    }
    applyScreenShareView(room);
  }, [applyScreenShareView, listScreenShares]);

  const setScreenVideoElement = useCallback(
    (el: HTMLVideoElement | null) => {
      const prev = screenVideoElRef.current;
      const track = boundShareTrackRef.current;
      if (prev && track && prev !== el) {
        try {
          track.detach(prev);
        } catch {
          /* ignore */
        }
      }
      screenVideoElRef.current = el;
      if (el && track) {
        track.attach(el);
        el.playsInline = true;
        el.autoplay = true;
        el.muted = activeScreenShare?.isLocal ?? false;
        void el.play().catch(() => undefined);
      }
    },
    [activeScreenShare?.isLocal],
  );

  const setScreenShareVolume = useCallback(
    (identity: string, volume: number) => {
      const v = Math.max(0, Math.min(100, Math.round(volume)));
      setScreenShareVolumes((prev) => {
        const next = { ...prev, [identity]: v };
        screenShareVolumesRef.current = next;
        saveScreenShareVolumes(next);
        return next;
      });
      const room = roomRef.current;
      if (!room) return;
      const p = room.remoteParticipants.get(identity);
      if (p) {
        setRemoteSourceVolume(
          p,
          Track.Source.ScreenShareAudio,
          listenLevel(audioSettingsRef.current.outputVolume, v),
        );
      }
    },
    [],
  );

  const setScreenShareViewQuality = useCallback(
    (id: ScreenShareViewQualityId) => {
      const q = normalizeScreenShareViewQuality(id);
      patchAudioSettings({ screenShareViewQuality: q });
      const room = roomRef.current;
      if (room) applyScreenShareView(room);
    },
    [applyScreenShareView, patchAudioSettings],
  );

  const setScreenShareResolution = useCallback(
    async (id: ScreenShareResolutionId) => {
      const res = normalizeScreenShareResolution(id);
      patchAudioSettings({ screenShareResolution: res });
      if (screenSharingRef.current) {
        await stopLocalScreenShare();
        await toggleScreenShare();
      }
    },
    [patchAudioSettings, stopLocalScreenShare, toggleScreenShare],
  );

  const setScreenShareFps = useCallback(
    async (fps: ScreenShareFps) => {
      const next = normalizeScreenShareFps(fps);
      patchAudioSettings({ screenShareFps: next });
      if (screenSharingRef.current) {
        await stopLocalScreenShare();
        await toggleScreenShare();
      }
    },
    [patchAudioSettings, stopLocalScreenShare, toggleScreenShare],
  );

  const setNsfwContentFilter = useCallback(
    (enabled: boolean) => {
      patchAudioSettings({ nsfwContentFilter: enabled });
      const room = roomRef.current;
      if (!enabled) {
        stopNsfwMonitor();
      } else if (room && screenSharingRef.current) {
        startLocalScreenShareNsfwGuard(room);
      }
    },
    [patchAudioSettings, startLocalScreenShareNsfwGuard, stopNsfwMonitor],
  );

  const attachCamera = useCallback(
    (identity: string, el: HTMLVideoElement | null) => {
      if (!el) {
        cameraEls.current.delete(identity);
        return;
      }
      cameraEls.current.set(identity, el);
      const room = roomRef.current;
      if (!room) return;
      if (identity === userId) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        pub?.track?.attach(el);
      } else {
        const p = room.remoteParticipants.get(identity);
        const pub = p
          ? Array.from(p.trackPublications.values()).find((x) => x.source === Track.Source.Camera)
          : undefined;
        pub?.track?.attach(el);
      }
    },
    [userId],
  );

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    deafenedRef.current = deafened;
    for (const el of attached.current) el.muted = deafened || afkSilenceRef.current;
  }, [deafened]);

  useEffect(() => {
    void refreshAudioDevices(true);
  }, [refreshAudioDevices]);

  useEffect(() => {
    if (!connected) {
      setLatencyMs(null);
      return;
    }
    let cancelled = false;
    let ema: number | null = null;
    const tick = async () => {
      const room = roomRef.current;
      if (!room || cancelled) return;
      const ms = await readPublisherRttMs(room);
      if (cancelled || ms == null || !Number.isFinite(ms)) return;
      if (ema == null) ema = ms;
      else if (ms < ema) ema = ema * 0.45 + ms * 0.55;
      else ema = ema * 0.82 + ms * 0.18;
      setLatencyMs(Math.max(1, Math.round(ema)));
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connected, voiceChannelId]);

  useEffect(() => {
    if (!connected) {
      setServerLatencyMs(null);
      return;
    }
    let cancelled = false;
    let ema: number | null = null;
    const base = API_URL.replace(/\/$/, '');
    const tick = async () => {
      if (cancelled || !base) return;
      const once = async () => {
        const t0 = performance.now();
        await fetch(`${base}/health`, {
          method: 'GET',
          cache: 'no-store',
          keepalive: true,
        });
        return performance.now() - t0;
      };
      try {
        const a = await once();
        const b = await once();
        if (cancelled) return;
        const ms = Math.max(1, Math.round(Math.min(a, b)));
        if (ema == null) ema = ms;
        else if (ms < ema) ema = ema * 0.4 + ms * 0.6;
        else ema = ema * 0.85 + ms * 0.15;
        setServerLatencyMs(Math.max(1, Math.round(ema)));
      } catch {
        if (!cancelled) setServerLatencyMs(null);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connected, voiceChannelId]);

  useEffect(() => {
    return () => {
      joinGen.current += 1;
      const id = voiceChannelIdRef.current;
      void teardownRoom(id, voiceGuildIdRef.current, {
        playLeaveTone: Boolean(id),
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  const value = useMemo<VoiceSessionApi>(
    () => ({
      voiceChannelId,
      voiceGuildId,
      voiceChannelName,
      connected,
      latencyMs,
      serverLatencyMs,
      status,
      muted,
      deafened,
      cameraEnabled,
      screenSharing,
      noiseCancellation,
      peers,
      participants: peers,
      screenShares,
      activeScreenShare,
      screenShareViewPaused,
      screenShareVolumes,
      participantVolumes,
      audioSettings,
      audioInputDevices,
      audioOutputDevices,
      videoDevices,
      room: roomRef.current,
      voiceOnOtherClient,
      voiceElsewherePlatform,
      reclaimVoice,
      join,
      leave,
      setMuted,
      setDeafened,
      setAfkSilence,
      voiceChannelType,
      toggleCamera,
      toggleScreenShare,
      toggleNoiseCancellation,
      focusScreenShare,
      pauseScreenShareView,
      resumeScreenShareView,
      setScreenVideoElement,
      setScreenShareVolume,
      setParticipantVolume,
      getParticipantVolume,
      isLocalMutedParticipant,
      toggleLocalMuteParticipant,
      setMicVolume,
      setOutputVolume,
      setInputDevice,
      setOutputDevice,
      setVideoDevice,
      setAudioBitrate,
      refreshAudioDevices,
      setScreenShareResolution,
      setScreenShareFps,
      setScreenShareViewQuality,
      setNsfwContentFilter,
      attachCamera,
    }),
    [
      activeScreenShare,
      attachCamera,
      audioInputDevices,
      audioOutputDevices,
      audioSettings,
      cameraEnabled,
      connected,
      deafened,
      focusScreenShare,
      getParticipantVolume,
      isLocalMutedParticipant,
      join,
      latencyMs,
      leave,
      muted,
      reclaimVoice,
      serverLatencyMs,
      voiceElsewherePlatform,
      voiceOnOtherClient,
      toggleLocalMuteParticipant,
      noiseCancellation,
      pauseScreenShareView,
      participantVolumes,
      peers,
      refreshAudioDevices,
      resumeScreenShareView,
      screenShareViewPaused,
      screenShareVolumes,
      screenShares,
      screenSharing,
      setAfkSilence,
      setAudioBitrate,
      setDeafened,
      setInputDevice,
      setMicVolume,
      setMuted,
      setNsfwContentFilter,
      setOutputDevice,
      setOutputVolume,
      setParticipantVolume,
      setScreenShareFps,
      setScreenShareResolution,
      setScreenShareViewQuality,
      setScreenShareVolume,
      setScreenVideoElement,
      setVideoDevice,
      status,
      toggleCamera,
      toggleNoiseCancellation,
      toggleScreenShare,
      videoDevices,
      voiceChannelId,
      voiceChannelName,
      voiceChannelType,
      voiceGuildId,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <ScreenSharePicker
        open={pickerOpen}
        sources={pickerSources}
        loading={pickerLoading}
        onCancel={() => {
          void window.dracordDesktop?.clearDisplayMediaSelection?.();
          closeScreenSharePicker(null);
        }}
        onConfirm={(sel) => closeScreenSharePicker(sel)}
      />
    </Ctx.Provider>
  );
}

export function useVoiceSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('VoiceSessionProvider gerekli');
  return v;
}

export { SCREEN_SHARE_VIEW_QUALITY_SPECS };
