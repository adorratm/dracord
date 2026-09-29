'use client';

import type { VoiceParticipant } from '@dracord/ui';
import {
  Room,
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type LocalParticipant,
  type LocalTrackPublication,
  type RemoteParticipant,
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
  loadVoiceAudioSettings,
  micVolumeToPresenceDb,
  saveVoiceAudioSettings,
  type VoiceAudioSettings,
} from '@/lib/voice-settings';

export interface ActiveScreenShare {
  identity: string;
  displayName: string;
  isLocal: boolean;
}

interface VoiceSessionValue {
  voiceChannelId: string | null;
  voiceGuildId: string | null;
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  activeScreenShare: ActiveScreenShare | null;
  setScreenVideoElement: (el: HTMLVideoElement | null) => void;
  participants: VoiceParticipant[];
  error: string | null;
  noiseCancellation: boolean;
  noiseNote: string | null;
  audioSettings: VoiceAudioSettings;
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  refreshAudioDevices: () => Promise<void>;
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  setMicVolume: (volume: number) => void;
  setOutputVolume: (volume: number) => void;
  join: (channelId: string, guildId: string) => void;
  leave: () => string | null;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleNoiseCancellation: () => Promise<void>;
}

const VoiceSessionContext = createContext<VoiceSessionValue | null>(null);

function participantFromRemote(p: RemoteParticipant): VoiceParticipant {
  const audioPub = p.getTrackPublication(Track.Source.Microphone);
  return {
    id: p.identity,
    displayName: p.name || p.identity,
    muted: audioPub?.isMuted ?? !p.isMicrophoneEnabled,
    speaking: p.isSpeaking,
    video: Boolean(p.getTrackPublication(Track.Source.ScreenShare)?.track),
  };
}

function participantFromLocal(p: LocalParticipant, muted: boolean): VoiceParticipant {
  return {
    id: p.identity,
    displayName: p.name || p.identity,
    muted,
    speaking: p.isSpeaking,
    video: Boolean(p.getTrackPublication(Track.Source.ScreenShare)?.track),
  };
}

function getMicTrack(room: Room): LocalAudioTrack | undefined {
  const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const track = pub?.track;
  return track && track.kind === 'audio' ? (track as LocalAudioTrack) : undefined;
}

function applyDeafen(room: Room, deafened: boolean) {
  room.remoteParticipants.forEach((p) => {
    p.audioTrackPublications.forEach((pub) => {
      pub.setEnabled(!deafened);
    });
  });
}

function applyOutputVolume(room: Room, volume: number) {
  room.remoteParticipants.forEach((p) => {
    p.setVolume(volume);
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
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Ekran paylaşımı yalnızca güvenli bağlamda (localhost veya HTTPS) çalışır.';
  }
  return msg || 'Ekran paylaşımı başarısız';
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
  const knownPeersRef = useRef(new Set<string>());
  const screenTrackRef = useRef<Track | null>(null);
  const screenVideoElRef = useRef<HTMLVideoElement | null>(null);
  const mutedRef = useRef(false);
  const channelIdRef = useRef<string | null>(null);
  const guildIdRef = useRef<string | null>(null);
  const audioSettingsRef = useRef<VoiceAudioSettings>(loadVoiceAudioSettings());

  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeScreenShare, setActiveScreenShare] = useState<ActiveScreenShare | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noiseCancellation, setNoiseCancellation] = useState(false);
  const [noiseNote, setNoiseNote] = useState<string | null>(null);
  const [audioSettings, setAudioSettings] = useState<VoiceAudioSettings>(() =>
    loadVoiceAudioSettings(),
  );
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);

  mutedRef.current = muted;
  channelIdRef.current = voiceChannelId;
  guildIdRef.current = voiceGuildId;
  audioSettingsRef.current = audioSettings;

  const persistAudio = useCallback((next: VoiceAudioSettings) => {
    setAudioSettings(next);
    audioSettingsRef.current = next;
    saveVoiceAudioSettings(next);
  }, []);

  const refreshAudioDevices = useCallback(async () => {
    try {
      const [inputs, outputs] = await Promise.all([
        Room.getLocalDevices('audioinput', true),
        Room.getLocalDevices('audiooutput', true),
      ]);
      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);
    } catch {
      setAudioInputDevices([]);
      setAudioOutputDevices([]);
    }
  }, []);

  useEffect(() => {
    void refreshAudioDevices();
    const onChange = () => void refreshAudioDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, [refreshAudioDevices]);

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
      try {
        if (settings.inputDeviceId) {
          await room.switchActiveDevice('audioinput', settings.inputDeviceId);
        }
      } catch {
        // cihaz yoksa yoksay
      }
      try {
        if (settings.outputDeviceId) {
          await room.switchActiveDevice('audiooutput', settings.outputDeviceId);
        }
      } catch {
        // sinkId desteklenmiyorsa yoksay
      }
      applyOutputVolume(room, settings.outputVolume);
      const mic = getMicTrack(room);
      if (mic) {
        await applyMicGainToTrack(mic, settings.micVolume).catch(() => undefined);
      }
    },
    [applyMicGainToTrack],
  );

  const refreshParticipants = useCallback((room: Room, isMuted: boolean) => {
    const list: VoiceParticipant[] = [];
    if (room.localParticipant) {
      list.push(participantFromLocal(room.localParticipant, isMuted));
    }
    room.remoteParticipants.forEach((p) => {
      list.push(participantFromRemote(p));
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
    setActiveScreenShare(null);
  }, []);

  const bindScreenShareTrack = useCallback(
    (track: Track | null, identity: string, displayName: string, isLocal: boolean) => {
      const el = screenVideoElRef.current;
      if (screenTrackRef.current && el) {
        try {
          screenTrackRef.current.detach(el);
        } catch {
          // ignore
        }
      }
      screenTrackRef.current = track;
      if (!track) {
        setActiveScreenShare(null);
        return;
      }
      setActiveScreenShare({ identity, displayName, isLocal });
      if (el) {
        track.attach(el);
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
      void el.play().catch(() => undefined);
    }
  }, []);

  const pickPreferredScreenShare = useCallback(
    (room: Room) => {
      const localPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (localPub?.track) {
        bindScreenShareTrack(
          localPub.track,
          room.localParticipant.identity,
          room.localParticipant.name || room.localParticipant.identity,
          true,
        );
        setScreenSharing(true);
        return;
      }
      for (const p of room.remoteParticipants.values()) {
        const pub = p.getTrackPublication(Track.Source.ScreenShare);
        if (pub?.track) {
          bindScreenShareTrack(pub.track, p.identity, p.name || p.identity, false);
          return;
        }
      }
      clearScreenShareView();
      setScreenSharing(Boolean(localPub?.track));
    },
    [bindScreenShareTrack, clearScreenShareView],
  );

  useEffect(() => {
    if (!voiceChannelId || !user) {
      return;
    }

    const channelId = voiceChannelId;
    const guildId = voiceGuildId;
    let disposed = false;
    const settings = audioSettingsRef.current;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        deviceId: settings.inputDeviceId || undefined,
      },
      audioOutput: settings.outputDeviceId
        ? { deviceId: settings.outputDeviceId }
        : undefined,
    });
    roomRef.current = room;
    deepFilterActiveRef.current = false;
    clarityRef.current = null;
    micGainRef.current = null;
    knownPeersRef.current = new Set();
    setMuted(false);
    setDeafened(false);
    deafenedRef.current = false;
    setError(null);
    setNoiseCancellation(false);
    setNoiseNote(null);

    const sync = () => {
      if (!disposed) {
        refreshParticipants(room, mutedRef.current);
        pickPreferredScreenShare(room);
      }
    };

    room.on(RoomEvent.Connected, sync);
    room.on(RoomEvent.Disconnected, () => {
      if (!disposed) setConnected(false);
    });
    room.on(RoomEvent.ParticipantConnected, (p) => {
      if (!knownPeersRef.current.has(p.identity)) {
        knownPeersRef.current.add(p.identity);
        playUiTone('peer-join');
      }
      if (deafenedRef.current) applyDeafen(room, true);
      p.setVolume(audioSettingsRef.current.outputVolume);
      sync();
    });
    room.on(RoomEvent.ParticipantDisconnected, sync);
    room.on(RoomEvent.TrackMuted, sync);
    room.on(RoomEvent.TrackUnmuted, sync);
    room.on(RoomEvent.ActiveSpeakersChanged, sync);
    room.on(RoomEvent.TrackSubscribed, (_track, publication, participant) => {
      if (deafenedRef.current && publication.kind === 'audio') {
        publication.setEnabled(false);
      }
      if (publication.kind === 'audio') {
        participant.setVolume(audioSettingsRef.current.outputVolume);
      }
      sync();
    });
    room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
      if (publication.source === Track.Source.ScreenShare) sync();
    });
    room.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) setScreenSharing(true);
      sync();
    });
    room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) setScreenSharing(false);
      sync();
    });

    void (async () => {
      try {
        const { token, url } = await client.getVoiceToken(channelId);
        const livekitUrl =
          process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || url || 'ws://localhost:7880';
        await room.connect(livekitUrl, token);
        if (disposed) {
          room.disconnect();
          return;
        }

        await room.localParticipant.setMicrophoneEnabled(true);
        await applyRoomAudioSettings(room, audioSettingsRef.current);
        try {
          await client.joinVoiceState(channelId, { muted: false, deafened: false });
          if (guildId) {
            client.connectSocket();
            client.emitVoiceState({ guildId, channelId, muted: false, deafened: false });
          }
        } catch {
          // presence sync optional
        }

        playUiTone('join');
        setConnected(true);
        refreshParticipants(room, false);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Ses odasına bağlanılamadı');
          setVoiceChannelId(null);
          setVoiceGuildId(null);
        }
      }
    })();

    const heartbeat = window.setInterval(() => {
      void client.voiceHeartbeat(channelId).catch(() => undefined);
    }, 30_000);

    const onPageHide = () => {
      void client.leaveVoiceState(channelId).catch(() => undefined);
      if (guildId) {
        try {
          client.emitVoiceState({ guildId, channelId: null });
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      window.removeEventListener('pagehide', onPageHide);
      deepFilterActiveRef.current = false;
      clarityRef.current = null;
      micGainRef.current = null;
      setNoiseCancellation(false);
      setNoiseNote(null);
      setScreenSharing(false);
      clearScreenShareView();
      void (async () => {
        try {
          await client.leaveVoiceState(channelId);
          if (guildId) {
            client.emitVoiceState({ guildId, channelId: null });
          }
        } catch {
          // ignore
        }
        playUiTone('leave');
        room.disconnect();
      })();
      roomRef.current = null;
      setConnected(false);
      setParticipants([]);
    };
  }, [
    voiceChannelId,
    voiceGuildId,
    client,
    user,
    refreshParticipants,
    pickPreferredScreenShare,
    clearScreenShareView,
    applyRoomAudioSettings,
  ]);

  const join = useCallback((channelId: string, guildId: string) => {
    setVoiceChannelId((prev) => {
      if (prev === channelId) return prev;
      return channelId;
    });
    setVoiceGuildId(guildId);
  }, []);

  const leave = useCallback(() => {
    const channelId = channelIdRef.current;
    const guildId = guildIdRef.current;
    setVoiceChannelId(null);
    setVoiceGuildId(null);
    setConnected(false);
    setParticipants([]);
    setError(null);
    setScreenSharing(false);
    clearScreenShareView();
    // Presence'i hemen temizle (effect cleanup da yapar; çift çağrı zararsız)
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
  }, [client, clearScreenShareView]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    const channelId = channelIdRef.current;
    if (!room || !channelId) return;
    const next = !mutedRef.current;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
    refreshParticipants(room, next);
    try {
      await client.updateVoiceState(channelId, {
        muted: next,
        deafened: deafenedRef.current,
      });
      const guildId = guildIdRef.current;
      if (guildId) {
        client.emitVoiceState({
          guildId,
          channelId,
          muted: next,
          deafened: deafenedRef.current,
        });
      }
    } catch {
      // ignore
    }
  }, [client, refreshParticipants]);

  const toggleDeafen = useCallback(async () => {
    const room = roomRef.current;
    const channelId = channelIdRef.current;
    if (!room || !channelId) return;
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    applyDeafen(room, next);
    let nextMuted = mutedRef.current;
    if (next && !mutedRef.current) {
      await room.localParticipant.setMicrophoneEnabled(false);
      nextMuted = true;
      setMuted(true);
    }
    setDeafened(next);
    refreshParticipants(room, next ? true : nextMuted);
    try {
      await client.updateVoiceState(channelId, {
        muted: next ? true : nextMuted,
        deafened: next,
      });
      const guildId = guildIdRef.current;
      if (guildId) {
        client.emitVoiceState({
          guildId,
          channelId,
          muted: next ? true : nextMuted,
          deafened: next,
        });
      }
    } catch {
      // ignore
    }
  }, [client, refreshParticipants]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    setError(null);

    if (screenSharing) {
      try {
        await room.localParticipant.setScreenShareEnabled(false);
        setScreenSharing(false);
        pickPreferredScreenShare(room);
        refreshParticipants(room, mutedRef.current);
      } catch (err) {
        setError(screenShareErrorMessage(err));
      }
      return;
    }

    try {
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true,
        resolution: { width: 1920, height: 1080, frameRate: 30 },
        contentHint: 'detail',
      });
      setScreenSharing(true);
      pickPreferredScreenShare(room);
      refreshParticipants(room, mutedRef.current);
    } catch (err) {
      setScreenSharing(false);
      setError(screenShareErrorMessage(err));
      try {
        await room.localParticipant.setScreenShareEnabled(false);
      } catch {
        // ignore
      }
    }
  }, [screenSharing, refreshParticipants, pickPreferredScreenShare]);

  const setInputDevice = useCallback(
    async (deviceId: string) => {
      const next = { ...audioSettingsRef.current, inputDeviceId: deviceId };
      persistAudio(next);
      const room = roomRef.current;
      if (!room) return;
      try {
        if (deviceId) {
          await room.switchActiveDevice('audioinput', deviceId);
        } else {
          const devices = await Room.getLocalDevices('audioinput', false);
          const fallback = devices.find((d) => d.deviceId && d.deviceId !== 'default') ?? devices[0];
          if (fallback?.deviceId) {
            await room.switchActiveDevice('audioinput', fallback.deviceId);
          }
        }
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
        } else {
          const devices = await Room.getLocalDevices('audiooutput', false);
          const fallback = devices.find((d) => d.deviceId && d.deviceId !== 'default') ?? devices[0];
          if (fallback?.deviceId) {
            await room.switchActiveDevice('audiooutput', fallback.deviceId);
          }
        }
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
      if (room) applyOutputVolume(room, outputVolume);
    },
    [persistAudio],
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
      muted,
      deafened,
      screenSharing,
      activeScreenShare,
      setScreenVideoElement,
      participants,
      error,
      noiseCancellation,
      noiseNote,
      audioSettings,
      audioInputDevices,
      audioOutputDevices,
      refreshAudioDevices,
      setInputDevice,
      setOutputDevice,
      setMicVolume,
      setOutputVolume,
      join,
      leave,
      toggleMute,
      toggleDeafen,
      toggleScreenShare,
      toggleNoiseCancellation,
    }),
    [
      voiceChannelId,
      voiceGuildId,
      connected,
      muted,
      deafened,
      screenSharing,
      activeScreenShare,
      setScreenVideoElement,
      participants,
      error,
      noiseCancellation,
      noiseNote,
      audioSettings,
      audioInputDevices,
      audioOutputDevices,
      refreshAudioDevices,
      setInputDevice,
      setOutputDevice,
      setMicVolume,
      setOutputVolume,
      join,
      leave,
      toggleMute,
      toggleDeafen,
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
