/** Kullanıcının seçebileceği Opus bitrate’leri (kbps). */
export const VOICE_BITRATE_PRESETS = [320, 192, 160, 128, 64, 32] as const;
export type VoiceBitrateKbps = (typeof VOICE_BITRATE_PRESETS)[number];
/** Varsayılan: dengeli kalite, patlamayı azaltır */
export const DEFAULT_AUDIO_BITRATE_KBPS: VoiceBitrateKbps = 128;

/** Ekran paylaşımı çözünürlük önayarları (kişisel). */
export const SCREEN_SHARE_RESOLUTION_PRESETS = [
  '720p',
  '1080p',
  '1440p',
  '4k',
  '5k',
  '8k',
] as const;
export type ScreenShareResolutionId = (typeof SCREEN_SHARE_RESOLUTION_PRESETS)[number];
export const DEFAULT_SCREEN_SHARE_RESOLUTION: ScreenShareResolutionId = '1080p';

export const SCREEN_SHARE_FPS_PRESETS = [15, 24, 30, 60] as const;
export type ScreenShareFps = (typeof SCREEN_SHARE_FPS_PRESETS)[number];
export const DEFAULT_SCREEN_SHARE_FPS: ScreenShareFps = 30;

export interface ScreenShareResolutionSpec {
  id: ScreenShareResolutionId;
  label: string;
  width: number;
  height: number;
  /** Yayın max bitrate (bps) */
  maxBitrate: number;
}

export const SCREEN_SHARE_RESOLUTION_SPECS: Record<
  ScreenShareResolutionId,
  ScreenShareResolutionSpec
> = {
  '720p': {
    id: '720p',
    label: '720p (1280×720)',
    width: 1280,
    height: 720,
    maxBitrate: 2_500_000,
  },
  '1080p': {
    id: '1080p',
    label: '1080p (1920×1080)',
    width: 1920,
    height: 1080,
    maxBitrate: 4_500_000,
  },
  '1440p': {
    id: '1440p',
    label: '1440p (2560×1440)',
    width: 2560,
    height: 1440,
    maxBitrate: 8_000_000,
  },
  '4k': {
    id: '4k',
    label: '4K (3840×2160)',
    width: 3840,
    height: 2160,
    maxBitrate: 16_000_000,
  },
  '5k': {
    id: '5k',
    label: '5K (5120×2880)',
    width: 5120,
    height: 2880,
    maxBitrate: 28_000_000,
  },
  '8k': {
    id: '8k',
    label: '8K (7680×4320)',
    width: 7680,
    height: 4320,
    maxBitrate: 45_000_000,
  },
};

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
  /** Mikrofon yayın bitrate (kbps). */
  audioBitrateKbps: VoiceBitrateKbps;
  /** Ekran paylaşımı çözünürlüğü (kişisel) */
  screenShareResolution: ScreenShareResolutionId;
  /** Ekran paylaşımı FPS (kişisel) */
  screenShareFps: ScreenShareFps;
}

export const DEFAULT_VOICE_AUDIO: VoiceAudioSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  videoDeviceId: '',
  micVolume: 1,
  outputVolume: 1,
  audioBitrateKbps: DEFAULT_AUDIO_BITRATE_KBPS,
  screenShareResolution: DEFAULT_SCREEN_SHARE_RESOLUTION,
  screenShareFps: DEFAULT_SCREEN_SHARE_FPS,
};

export function normalizeBitrateKbps(value: unknown): VoiceBitrateKbps {
  const n = typeof value === 'number' ? value : Number(value);
  if ((VOICE_BITRATE_PRESETS as readonly number[]).includes(n)) {
    return n as VoiceBitrateKbps;
  }
  return DEFAULT_AUDIO_BITRATE_KBPS;
}

export function normalizeScreenShareResolution(value: unknown): ScreenShareResolutionId {
  if (
    typeof value === 'string' &&
    (SCREEN_SHARE_RESOLUTION_PRESETS as readonly string[]).includes(value)
  ) {
    return value as ScreenShareResolutionId;
  }
  return DEFAULT_SCREEN_SHARE_RESOLUTION;
}

export function normalizeScreenShareFps(value: unknown): ScreenShareFps {
  const n = typeof value === 'number' ? value : Number(value);
  if ((SCREEN_SHARE_FPS_PRESETS as readonly number[]).includes(n)) {
    return n as ScreenShareFps;
  }
  return DEFAULT_SCREEN_SHARE_FPS;
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

/**
 * UI 0–200% → gerçek yayın/kulaklık çarpanı.
 * 100% üzeri yumuşak eğri (patlamayı azaltır): 200% ≈ 1.35×
 */
export function softVolumeCurve(volume: number): number {
  const v = clampVolume(volume);
  if (v <= 1) return v;
  return 1 + (v - 1) * 0.35;
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
      screenShareResolution: normalizeScreenShareResolution(parsed.screenShareResolution),
      screenShareFps: normalizeScreenShareFps(parsed.screenShareFps),
    };
  } catch {
    return { ...DEFAULT_VOICE_AUDIO };
  }
}

export function saveVoiceAudioSettings(settings: VoiceAudioSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Mic volume (0–2) → DeepFilter presenceGainDb (yumuşak eğri, ekstra boost yok) */
export function micVolumeToPresenceDb(volume: number): number {
  const v = Math.max(0.01, softVolumeCurve(volume));
  return 20 * Math.log10(v);
}

export function screenShareCaptureResolution(settings: VoiceAudioSettings): {
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
} {
  const spec = SCREEN_SHARE_RESOLUTION_SPECS[settings.screenShareResolution];
  const fps = settings.screenShareFps;
  // Yüksek çözünürlükte FPS’i biraz sınırla (tarayıcı/bant)
  const frameRate =
    spec.height >= 4320 ? Math.min(fps, 30) : spec.height >= 2160 ? Math.min(fps, 30) : fps;
  const bitrateScale = frameRate > 30 ? 1.25 : 1;
  return {
    width: spec.width,
    height: spec.height,
    frameRate,
    maxBitrate: Math.round(spec.maxBitrate * bitrateScale),
  };
}
