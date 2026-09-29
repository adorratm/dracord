export interface VoiceAudioSettings {
  /** Boş = sistem varsayılanı */
  inputDeviceId: string;
  /** Boş = sistem varsayılanı */
  outputDeviceId: string;
  /** 0–2 (0%–200%), varsayılan 1 */
  micVolume: number;
  /** 0–2 (0%–200%), varsayılan 1 */
  outputVolume: number;
}

export const DEFAULT_VOICE_AUDIO: VoiceAudioSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  micVolume: 1,
  outputVolume: 1,
};

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
      micVolume: clampVolume(parsed.micVolume ?? 1),
      outputVolume: clampVolume(parsed.outputVolume ?? 1),
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
