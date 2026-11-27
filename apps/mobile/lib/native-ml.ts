/**
 * Cihaz üstü konuşma tanıma + çeviri (native modüller).
 *
 * Bu modüller yalnız yeni mağaza sürümünde var. Eski sürümlere OTA ile aynı JS gider,
 * bu yüzden hiçbiri doğrudan içe aktarılmaz: varsa kullanılır, yoksa özellik gizlenir
 * (çökme yok). `runtimeVersion` değişmeden herkes güncelleme almaya devam eder.
 */
import { NativeModules, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// ── Konuşma tanıma (expo-speech-recognition) ────────────────────────────────

type SpeechResultEvent = { isFinal: boolean; results: Array<{ transcript: string }> };
type SpeechErrorEvent = { error: string; message: string };
type Subscription = { remove(): void };

export type SpeechModule = {
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean; canAskAgain?: boolean }>;
  isRecognitionAvailable(): boolean;
  supportsOnDeviceRecognition(): boolean;
  addListener(event: 'result', l: (e: SpeechResultEvent) => void): Subscription;
  addListener(event: 'error', l: (e: SpeechErrorEvent) => void): Subscription;
  addListener(event: 'end', l: () => void): Subscription;
};

let speechCache: SpeechModule | null | undefined;
export function speechModule(): SpeechModule | null {
  if (speechCache !== undefined) return speechCache;
  try {
    speechCache = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');
  } catch {
    speechCache = null;
  }
  return speechCache;
}

export function canCaptionSelf(): boolean {
  const m = speechModule();
  if (!m) return false;
  try {
    return m.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/** Görüşmeyle aynı ses oturumu: tanıma mikrofonu görüşmeden "çalmaz" (iOS) */
export const SPEECH_IOS_CATEGORY = {
  category: 'playAndRecord',
  categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
  mode: 'voiceChat',
} as const;

export function speechErrorText(code: string): string {
  switch (code) {
    case 'not-allowed':
      return 'Mikrofon ya da konuşma tanıma izni verilmedi (Ayarlar › Dracord).';
    case 'audio-capture':
    case 'busy':
      return 'Bu cihaz görüşme sırasında konuşma tanımaya mikrofon vermiyor.';
    case 'language-not-supported':
      return 'Bu dil için konuşma tanıma yok.';
    case 'service-not-allowed':
      return 'Cihazda konuşma tanıma hizmeti kapalı ya da yok.';
    case 'network':
      return 'Konuşma tanıma için bağlantı gerekiyor.';
    default:
      return 'Altyazı durdu.';
  }
}

// ── Çeviri (Google ML Kit, cihaz üstü) ──────────────────────────────────────

type MlTranslate = {
  translate(o: { text: string; sourceLanguage: string; targetLanguage: string; downloadModelIfNeeded?: boolean; requireWifi?: boolean }): Promise<string>;
};
type MlIdentify = { identify(text: string): Promise<string> };

function nativeTranslate(): MlTranslate | null {
  const m = (NativeModules as Record<string, unknown>).TranslateText;
  return m && typeof (m as MlTranslate).translate === 'function' ? (m as MlTranslate) : null;
}
function nativeIdentify(): MlIdentify | null {
  const m = (NativeModules as Record<string, unknown>).IdentifyLanguages;
  return m && typeof (m as MlIdentify).identify === 'function' ? (m as MlIdentify) : null;
}

/** ML Kit'in desteklediği diller (cihaz üstü modeller) */
const ML_LANGS = new Set(
  'af sq ar be bg bn ca zh hr cs da nl en eo et fi fr gl ka de el gu ht he hi hu is id ga it ja kn ko lt lv mk mr ms mt no fa pl pt ro ru sk sl es sv sw tl ta te th tr uk ur vi cy'.split(' '),
);

export function canTranslateOnDevice(): boolean {
  return Platform.OS !== 'web' && !!nativeTranslate() && !!nativeIdentify();
}

export type DeviceTranslateResult =
  | { ok: true; text: string; source: string }
  | { ok: false; reason: 'unsupported' | 'same_language' | 'unknown_language' | 'failed'; message?: string };

/** Metni cihazda çevir; kaynak dil verilmezse ML Kit ile tespit edilir. Model ilk kullanımda iner (~30 MB). */
export async function translateOnDevice(text: string, target: string, source?: string | null): Promise<DeviceTranslateResult> {
  const tr = nativeTranslate();
  const id = nativeIdentify();
  if (!tr || !id) return { ok: false, reason: 'unsupported' };
  const tgt = target.split('-')[0]!.toLowerCase();
  try {
    let src = (source ?? '').split('-')[0]!.toLowerCase();
    if (!src) src = (await id.identify(text.slice(0, 1000))).split('-')[0]!.toLowerCase();
    if (!src || src === 'und' || !ML_LANGS.has(src) || !ML_LANGS.has(tgt)) return { ok: false, reason: 'unknown_language' };
    if (src === tgt) return { ok: false, reason: 'same_language' };
    const out = await tr.translate({ text: text.slice(0, 4500), sourceLanguage: src, targetLanguage: tgt, downloadModelIfNeeded: true });
    return typeof out === 'string' && out.trim() ? { ok: true, text: out, source: src } : { ok: false, reason: 'failed' };
  } catch (e) {
    return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
}
