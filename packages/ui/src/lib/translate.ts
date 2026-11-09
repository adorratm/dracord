/**
 * Mesaj çevirisi — SUNUCU MALİYETİ YOK.
 *
 * 1) Cihaz üstü: tarayıcı yerleşik Translator + LanguageDetector API
 *    (Chrome 138+ / Edge 148+ masaüstü). Model tarayıcıya bir kez iner, metin cihazdan çıkmaz.
 * 2) Yedek: kullanıcının kendi tarayıcısında harici çeviri sayfası (Google Çeviri) — kullanıcı tıklar.
 *
 * 1b) Yerleşik API yoksa (Electron, Firefox, Safari): transformers.js + opus-mt, Web Worker
 *     (`translate-local.ts`) — kullanıcı onayıyla bir kez dil paketi iner.
 */
import {
  guessLanguage,
  localPlan,
  modelsMb,
  localTranslationConsented,
  localTranslationSupported,
  setLocalTranslationConsent,
  translateLocally,
} from './translate-local';

export { localTranslationConsented, setLocalTranslationConsent };

type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

type TranslatorInstance = { translate(text: string): Promise<string>; destroy?: () => void };
type TranslatorStatic = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<TranslatorInstance>;
};
type DetectorInstance = {
  detect(text: string): Promise<Array<{ detectedLanguage: string; confidence: number }>>;
};
type DetectorStatic = {
  availability(): Promise<Availability>;
  create(o?: { monitor?: (m: EventTarget) => void }): Promise<DetectorInstance>;
};

function api(): { T?: TranslatorStatic; D?: DetectorStatic } {
  if (typeof self === 'undefined') return {};
  const g = self as unknown as { Translator?: TranslatorStatic; LanguageDetector?: DetectorStatic };
  return { T: g.Translator, D: g.LanguageDetector };
}

/** Bu cihazda cihaz üstü çeviri API'si var mı */
export function onDeviceTranslationSupported(): boolean {
  return Boolean(api().T) || localTranslationSupported();
}

/** Kullanıcı arayüz dili (tr varsayılan) */
export function preferredTranslateTarget(): string {
  if (typeof navigator === 'undefined') return 'tr';
  const lang = (navigator.language || 'tr').split('-')[0]!.toLowerCase();
  return lang || 'tr';
}

const translators = new Map<string, Promise<TranslatorInstance>>();
let detector: Promise<DetectorInstance> | null = null;

async function detectLanguage(text: string): Promise<string | null> {
  const { D } = api();
  if (!D) return null;
  try {
    if (!detector) {
      const av = await D.availability();
      if (av === 'unavailable') return null;
      detector = D.create();
    }
    const res = await (await detector).detect(text);
    const top = res[0];
    if (!top || top.confidence < 0.4 || top.detectedLanguage === 'und') return null;
    return top.detectedLanguage.split('-')[0]!;
  } catch {
    detector = null;
    return null;
  }
}

export type TranslateResult =
  | { ok: true; text: string; source: string; target: string }
  | { ok: false; reason: 'unsupported' | 'same_language' | 'unavailable_pair' | 'failed'; source?: string }
  /** Yerel model ilk kez inecek — kullanıcıya boyutu göster, onaylarsa `allowDownload: true` ile tekrar çağır */
  | { ok: false; reason: 'needs_consent'; source: string; target: string; downloadMb: number };

/**
 * Cihaz üstü çevir. Kullanıcı tıklamasıyla çağrılmalı (model indirme izni için).
 * onProgress: 0–1 model indirme ilerlemesi.
 */
export async function translateOnDevice(
  text: string,
  opts?: { target?: string; source?: string; onProgress?: (p: number) => void; allowDownload?: boolean },
): Promise<TranslateResult> {
  const { T } = api();
  if (!T) return translateFallback(text, opts);
  const target = (opts?.target || preferredTranslateTarget()).toLowerCase();
  const source = opts?.source || (await detectLanguage(text)) || 'en';
  if (source === target) return { ok: false, reason: 'same_language', source };
  const key = `${source}>${target}`;
  try {
    let inst = translators.get(key);
    if (!inst) {
      const av = await T.availability({ sourceLanguage: source, targetLanguage: target });
      if (av === 'unavailable') return { ok: false, reason: 'unavailable_pair', source };
      inst = T.create({
        sourceLanguage: source,
        targetLanguage: target,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            const loaded = (e as Event & { loaded?: number }).loaded;
            if (typeof loaded === 'number') opts?.onProgress?.(loaded);
          });
        },
      });
      translators.set(key, inst);
    }
    const out = await (await inst).translate(text);
    return { ok: true, text: out, source, target };
  } catch {
    translators.delete(key);
    return { ok: false, reason: 'failed', source };
  }
}

async function translateFallback(
  text: string,
  opts?: { target?: string; source?: string; onProgress?: (p: number) => void; allowDownload?: boolean },
): Promise<TranslateResult> {
  if (!localTranslationSupported()) return { ok: false, reason: 'unsupported' };
  const target = (opts?.target || preferredTranslateTarget()).toLowerCase();
  const source = opts?.source || (await detectLanguage(text)) || guessLanguage(text);
  if (source === target) return { ok: false, reason: 'same_language', source };
  const plan = localPlan(source, target);
  if (!plan) return { ok: false, reason: 'unavailable_pair', source };
  if (!localTranslationConsented(plan.models)) {
    if (!opts?.allowDownload) {
      const missing = plan.models.filter((m) => !localTranslationConsented([m]));
      return { ok: false, reason: 'needs_consent', source, target, downloadMb: modelsMb(missing) };
    }
    setLocalTranslationConsent(plan.models);
  }
  try {
    const out = await translateLocally(text, plan, opts?.onProgress);
    if (!out.trim()) return { ok: false, reason: 'failed', source };
    return { ok: true, text: out, source, target };
  } catch {
    return { ok: false, reason: 'failed', source };
  }
}

/** Harici çeviri sayfası (kullanıcının tarayıcısında açılır) */
export function externalTranslateUrl(text: string, target = preferredTranslateTarget()): string {
  const q = new URLSearchParams({ sl: 'auto', tl: target, text: text.slice(0, 4500), op: 'translate' });
  return `https://translate.google.com/?${q.toString()}`;
}

const LANG_TR: Record<string, string> = {
  en: 'İngilizce', tr: 'Türkçe', de: 'Almanca', fr: 'Fransızca', es: 'İspanyolca', it: 'İtalyanca',
  ru: 'Rusça', ar: 'Arapça', fa: 'Farsça', ja: 'Japonca', ko: 'Korece', zh: 'Çince', pt: 'Portekizce',
  nl: 'Felemenkçe', pl: 'Lehçe', uk: 'Ukraynaca', az: 'Azerice', el: 'Yunanca', bg: 'Bulgarca',
};
export function languageNameTr(code: string): string {
  return LANG_TR[code] ?? code.toUpperCase();
}
