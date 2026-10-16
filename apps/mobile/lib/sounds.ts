/**
 * Kısa UI tonları — web `playUiTone` ile aynı notalar (WAV + expo-audio).
 * Native: `expo-audio` → `yarn android` / `yarn ios` ile rebuild gerekir.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

export type UiToneKind = 'join' | 'leave' | 'peer-join' | 'peer-leave';

let uiToneEnabled = true;
let uiToneVolume = 0.85;

/** Ayarlar / prefs yüklendiğinde çağır */
export function configureUiTones(opts: { enabled?: boolean; volume?: number }) {
  if (typeof opts.enabled === 'boolean') uiToneEnabled = opts.enabled;
  if (typeof opts.volume === 'number' && Number.isFinite(opts.volume)) {
    uiToneVolume = Math.max(0, Math.min(1, opts.volume));
  }
}

const SAMPLE_RATE = 22_050;
const CACHE_PREFIX = 'dracord-ui-tone-';

let modeReady = false;
const uriCache = new Map<UiToneKind, string>();
let ensurePromise: Promise<void> | null = null;

function writeWav(samples: Float32Array): string {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  if (typeof btoa === 'function') return btoa(binary);
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out +=
      chars[(n >> 18) & 63]! +
      chars[(n >> 12) & 63]! +
      (i + 1 < bytes.length ? chars[(n >> 6) & 63]! : '=') +
      (i + 2 < bytes.length ? chars[n & 63]! : '=');
  }
  return out;
}

function synthTone(
  freqs: Array<{ t: number; hz: number }>,
  duration: number,
  peak: number,
  attack = 0.02,
): Float32Array {
  const n = Math.max(1, Math.floor(SAMPLE_RATE * duration));
  const out = new Float32Array(n);
  let fi = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    while (fi + 1 < freqs.length && t >= freqs[fi + 1]!.t) fi += 1;
    const hz = freqs[fi]!.hz;
    const env =
      t < attack
        ? (t / attack) * peak
        : peak * Math.max(0, 1 - (t - attack) / Math.max(0.001, duration - attack));
    const phase = (t * hz) % 1;
    const tri = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
    out[i] = tri * env;
  }
  return out;
}

function samplesFor(kind: UiToneKind): Float32Array {
  if (kind === 'join') {
    return synthTone(
      [
        { t: 0, hz: 660 },
        { t: 0.09, hz: 880 },
      ],
      0.22,
      0.55,
    );
  }
  if (kind === 'leave') {
    return synthTone(
      [
        { t: 0, hz: 520 },
        { t: 0.1, hz: 390 },
        { t: 0.2, hz: 260 },
      ],
      0.38,
      0.58,
      0.025,
    );
  }
  if (kind === 'peer-join') {
    return synthTone(
      [
        { t: 0, hz: 560 },
        { t: 0.06, hz: 720 },
      ],
      0.14,
      0.42,
      0.01,
    );
  }
  return synthTone(
    [
      { t: 0, hz: 480 },
      { t: 0.07, hz: 340 },
    ],
    0.18,
    0.38,
    0.012,
  );
}

async function ensureToneFiles(): Promise<void> {
  if (uriCache.size === 4) return;
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;

  if (!modeReady) {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsRecording: false,
      });
      modeReady = true;
    } catch {
      /* LiveKit session açık olabilir */
    }
  }

  const kinds: UiToneKind[] = ['join', 'leave', 'peer-join', 'peer-leave'];
  for (const kind of kinds) {
    if (uriCache.has(kind)) continue;
    const path = `${dir}${CACHE_PREFIX}${kind}.wav`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      const b64 = writeWav(samplesFor(kind));
      await FileSystem.writeAsStringAsync(path, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    uriCache.set(kind, path);
  }
}

export function playUiTone(kind: UiToneKind): void {
  if (!uiToneEnabled || uiToneVolume <= 0) return;
  void (async () => {
    try {
      if (!ensurePromise) ensurePromise = ensureToneFiles();
      await ensurePromise;
      const uri = uriCache.get(kind);
      if (!uri) return;
      const player = createAudioPlayer({ uri }, { updateInterval: 1000 });
      player.volume = uiToneVolume;
      player.play();
      const ms =
        kind === 'leave' ? 450 : kind === 'join' ? 280 : kind === 'peer-leave' ? 220 : 180;
      setTimeout(() => {
        try {
          player.release();
        } catch {
          /* ignore */
        }
      }, ms + 100);
    } catch {
      /* native yok / session */
    }
  })();
}
