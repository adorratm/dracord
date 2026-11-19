/**
 * A10 — camera background: blur or a virtual background, applied on the device
 * (MediaPipe selfie segmentation via @livekit/track-processors; nothing is uploaded).
 */

export type CameraBackgroundMode = 'none' | 'blur' | 'image';

export interface CameraBackgroundSettings {
  mode: CameraBackgroundMode;
  blur: 'light' | 'strong';
  /** id from CAMERA_BACKGROUND_PRESETS */
  preset: string;
}

export const CAMERA_BG_KEY = 'dracord.camera-bg.v1';
export const CAMERA_BG_EVENT = 'dracord:camera-bg';
export const DEFAULT_CAMERA_BG: CameraBackgroundSettings = { mode: 'none', blur: 'light', preset: 'dracula' };

/** generated in a canvas: no image files to host */
export const CAMERA_BACKGROUND_PRESETS: Array<{ id: string; label: string; stops: string[] }> = [
  { id: 'dracula', label: 'Dracula', stops: ['#282a36', '#44475a', '#bd93f9'] },
  { id: 'sunset', label: 'Gün batımı', stops: ['#ff7a59', '#ff4f8b', '#5b2a86'] },
  { id: 'ocean', label: 'Okyanus', stops: ['#0f2027', '#203a43', '#2c7a9b'] },
  { id: 'forest', label: 'Orman', stops: ['#0b3d2e', '#1e6f50', '#a8e063'] },
  { id: 'office', label: 'Ofis', stops: ['#d7d2cc', '#c9c2b8', '#8e9eab'] },
];

export function normalizeCameraBackground(raw: unknown): CameraBackgroundSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const mode: CameraBackgroundMode = r.mode === 'blur' || r.mode === 'image' ? r.mode : 'none';
  const preset = CAMERA_BACKGROUND_PRESETS.some((p) => p.id === r.preset) ? String(r.preset) : DEFAULT_CAMERA_BG.preset;
  return { mode, blur: r.blur === 'strong' ? 'strong' : 'light', preset };
}

export function loadCameraBackground(): CameraBackgroundSettings {
  try {
    const raw = localStorage.getItem(CAMERA_BG_KEY);
    return raw ? normalizeCameraBackground(JSON.parse(raw)) : { ...DEFAULT_CAMERA_BG };
  } catch {
    return { ...DEFAULT_CAMERA_BG };
  }
}

export function saveCameraBackground(next: CameraBackgroundSettings): void {
  try {
    localStorage.setItem(CAMERA_BG_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  try {
    window.dispatchEvent(new CustomEvent(CAMERA_BG_EVENT, { detail: next }));
  } catch {
    /* not a browser */
  }
}

const imageCache = new Map<string, string>();
/** a 1280×720 gradient image (data URL) for a preset */
export function presetImageUrl(id: string): string {
  const cached = imageCache.get(id);
  if (cached) return cached;
  const p = CAMERA_BACKGROUND_PRESETS.find((x) => x.id === id) ?? CAMERA_BACKGROUND_PRESETS[0]!;
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 1280, 720);
  p.stops.forEach((s, i) => grad.addColorStop(i / Math.max(1, p.stops.length - 1), s));
  g.fillStyle = grad;
  g.fillRect(0, 0, 1280, 720);
  // soft light blobs so it does not look flat
  for (const [x, y, r, a] of [
    [260, 180, 260, 0.12],
    [1020, 540, 320, 0.1],
  ] as const) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 1280, 720);
  }
  const url = c.toDataURL('image/jpeg', 0.9);
  imageCache.set(id, url);
  return url;
}

/** the parts of @livekit/track-processors we use (the app passes its own import) */
export interface TrackProcessorsModule {
  supportsBackgroundProcessors: () => boolean;
  BackgroundProcessor: (opts: { mode: 'background-blur'; blurRadius?: number } | { mode: 'virtual-background'; imagePath: string }) => {
    switchTo(opts: { mode: 'disabled' } | { mode: 'background-blur'; blurRadius?: number } | { mode: 'virtual-background'; imagePath: string }): Promise<void>;
  };
}

export interface CameraTrackLike {
  setProcessor(p: never): Promise<void>;
  stopProcessor(): Promise<void>;
}

type Applied = { track: CameraTrackLike; processor: ReturnType<TrackProcessorsModule['BackgroundProcessor']> };
let applied: Applied | null = null;

/**
 * Put the chosen background on the camera track (or take it off). Safe to call
 * repeatedly; switches mode in place when the processor is already attached.
 * Returns false when this device cannot run it.
 */
export async function applyCameraBackground(
  track: CameraTrackLike | null | undefined,
  s: CameraBackgroundSettings,
  load: () => Promise<TrackProcessorsModule>,
): Promise<boolean> {
  if (!track) {
    applied = null;
    return true;
  }
  if (s.mode === 'none') {
    if (applied?.track === track) {
      applied = null;
      await track.stopProcessor().catch(() => undefined);
    }
    return true;
  }
  const mod = await load();
  if (!mod.supportsBackgroundProcessors()) return false;
  const opts =
    s.mode === 'blur'
      ? ({ mode: 'background-blur', blurRadius: s.blur === 'strong' ? 24 : 10 } as const)
      : ({ mode: 'virtual-background', imagePath: presetImageUrl(s.preset) } as const);
  if (applied?.track === track) {
    await applied.processor.switchTo(opts);
    return true;
  }
  const processor = mod.BackgroundProcessor(opts);
  await track.setProcessor(processor as never);
  applied = { track, processor };
  return true;
}
