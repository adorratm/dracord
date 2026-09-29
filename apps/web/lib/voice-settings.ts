/** Kullanıcının seçebileceği Opus bitrate’leri (kbps). Varsayılan en yüksek. */
export const VOICE_BITRATE_PRESETS = [320, 192, 160, 128, 64, 32] as const;
export type VoiceBitrateKbps = (typeof VOICE_BITRATE_PRESETS)[number];
export const DEFAULT_AUDIO_BITRATE_KBPS: VoiceBitrateKbps = 320;

export interface VoiceAudioSettings {
  /** Boş = sistem varsayılanı */
  inputDeviceId: string;
  /** Boş = sistem varsayılanı */
  outputDeviceId: string;
  /** Boş = sistem varsayılanı */
  videoDeviceId: string;
  /** 0–2 (0%–200%), varsayılan 1 */
  micVolume: number;
  /** 0–2 (0%–200%), varsayılan 1 */
  outputVolume: number;
  /** Mikrofon yayın bitrate (kbps). Varsayılan 320. */
  audioBitrateKbps: VoiceBitrateKbps;
}

export const DEFAULT_VOICE_AUDIO: VoiceAudioSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  videoDeviceId: '',
  micVolume: 1,
  outputVolume: 1,
  audioBitrateKbps: DEFAULT_AUDIO_BITRATE_KBPS,
};

export function normalizeBitrateKbps(value: unknown): VoiceBitrateKbps {
  const n = typeof value === 'number' ? value : Number(value);
  if ((VOICE_BITRATE_PRESETS as readonly number[]).includes(n)) {
    return n as VoiceBitrateKbps;
  }
  return DEFAULT_AUDIO_BITRATE_KBPS;
}

/** LiveKit audioPreset.maxBitrate (bps). */
export function audioBitrateToMaxBitrate(kbps: number): number {
  return normalizeBitrateKbps(kbps) * 1000;
}

const STORAGE_KEY = 'dracord_voice_audio';

function clampVolume(v: number) {
  if (Number.isNaN(v)) return 1;
  return Math.min(2, Math.max(0, v));
}

export function loadVoiceAudioSettings(): VoiceAudioSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_VOICE_AUDIO };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_AUDIO };
    const parsed = JSON.parse(raw) as Partial<VoiceAudioSettings>;
    return {
      inputDeviceId: typeof parsed.inputDeviceId === 'string' ? parsed.inputDeviceId : '',
      outputDeviceId: typeof parsed.outputDeviceId === 'string' ? parsed.outputDeviceId : '',
      videoDeviceId: typeof parsed.videoDeviceId === 'string' ? parsed.videoDeviceId : '',
      micVolume: clampVolume(parsed.micVolume ?? 1),
      outputVolume: clampVolume(parsed.outputVolume ?? 1),
      audioBitrateKbps: normalizeBitrateKbps(parsed.audioBitrateKbps),
    };
  } catch {
    return { ...DEFAULT_VOICE_AUDIO };
  }
}

export function saveVoiceAudioSettings(settings: VoiceAudioSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Mic volume (0–2) → DeepFilter presenceGainDb */
export function micVolumeToPresenceDb(volume: number): number {
  const v = Math.max(0.01, clampVolume(volume));
  return 20 * Math.log10(v) + 4;
}
