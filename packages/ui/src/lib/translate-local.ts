/**
 * Cihaz üstü çeviri YEDEĞİ — tarayıcıda yerleşik Translator API yoksa (Electron, Firefox, Safari).
 * Sunucu maliyeti yok: transformers.js (jsDelivr) + opus-mt modelleri (Hugging Face CDN),
 * Web Worker içinde WASM ile çalışır; metin cihazdan çıkmaz. Paket npm bağımlılığı değil —
 * yalnız kullanıcı onay verince indirilir ve tarayıcı önbelleğinde kalır.
 *
 * Yol: kaynak → en (küçük Marian) → hedef. Hedef yalnız 'en' veya 'tr'.
 */

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const CONSENT_KEY = 'dracord:local-translate-ok';

/** Kaynak → İngilizce (Xenova, quantized ~110 MB) */
const TO_EN: Record<string, string> = {
  tr: 'Xenova/opus-mt-tr-en',
  de: 'Xenova/opus-mt-de-en',
  fr: 'Xenova/opus-mt-fr-en',
  es: 'Xenova/opus-mt-es-en',
  it: 'Xenova/opus-mt-it-en',
  ru: 'Xenova/opus-mt-ru-en',
  ar: 'Xenova/opus-mt-ar-en',
  nl: 'Xenova/opus-mt-nl-en',
  ja: 'Xenova/opus-mt-ja-en',
  zh: 'Xenova/opus-mt-zh-en',
};
/** İngilizce → hedef */
const FROM_EN: Record<string, { model: string; mb: number }> = {
  tr: { model: 'onnx-community/opus-mt-tc-big-en-tr', mb: 300 },
};
const SMALL_MB = 110;

export function localTranslationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    !(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView
  );
}

function consented(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CONSENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Bu modeller için kullanıcı indirme onayı verdi mi (parametresizse: herhangi biri) */
export function localTranslationConsented(models?: string[]): boolean {
  const ok = consented();
  return models ? models.every((m) => ok.includes(m)) : ok.length > 0;
}

/** Onayı kaydet (models) veya tümünü geri al (false) */
export function setLocalTranslationConsent(models: string[] | false) {
  try {
    if (models === false) localStorage.removeItem(CONSENT_KEY);
    else localStorage.setItem(CONSENT_KEY, JSON.stringify([...new Set([...consented(), ...models])]));
  } catch {
    /* ignore */
  }
}

/** Basit yazı/kelime sezgisi (LanguageDetector API yokken) */
export function guessLanguage(text: string): string {
  const t = text.toLowerCase();
  if (/[ğış]/.test(t) || /\b(ve|bir|bu|için|değil|ne|çok|ama|mı|mi|ben|sen|var|yok)\b/.test(t)) return 'tr';
  if (/[Ѐ-ӿ]/.test(t)) return 'ru';
  if (/[؀-ۿ]/.test(t)) return 'ar';
  if (/[぀-ヿ]/.test(t)) return 'ja';
  if (/[一-鿿]/.test(t)) return 'zh';
  if (/ß|\b(und|nicht|ist|das|ich|der|die)\b/.test(t)) return 'de';
  if (/\b(le|la|les|est|et|pas|je|vous|une)\b/.test(t) && /[éèêàç]/.test(t)) return 'fr';
  if (/[ñ¿¡]|\b(el|los|las|es|y|pero|muy|que)\b/.test(t) && /[áéíóúñ]/.test(t)) return 'es';
  if (/\b(il|che|non|sono|una|per)\b/.test(t) && /[àèìòù]/.test(t)) return 'it';
  if (/\b(het|een|niet|ik|en|van)\b/.test(t) && /\b(het|niet)\b/.test(t)) return 'nl';
  return 'en';
}

/** Yaklaşık indirme boyutu (MB) */
export function modelsMb(models: string[]): number {
  return models.reduce((n, m) => n + (Object.values(FROM_EN).find((x) => x.model === m)?.mb ?? SMALL_MB), 0);
}

/** Bu çift için gereken modeller (sırasıyla) ya da null */
export function localPlan(source: string, target: string): { models: string[]; mb: number } | null {
  if (source === target) return null;
  const models: string[] = [];
  let mb = 0;
  if (source !== 'en') {
    const m = TO_EN[source];
    if (!m) return null;
    models.push(m);
    mb += SMALL_MB;
  }
  if (target !== 'en') {
    const m = FROM_EN[target];
    if (!m) return null;
    models.push(m.model);
    mb += m.mb;
  }
  return models.length ? { models, mb } : null;
}

const WORKER_SRC = `
import { pipeline, env } from '${TRANSFORMERS_URL}';
env.allowLocalModels = false;
const pipes = new Map();
self.onmessage = async (e) => {
  const { id, model, text } = e.data;
  try {
    let p = pipes.get(model);
    if (!p) {
      const files = {};
      p = pipeline('translation', model, {
        dtype: 'q8',
        progress_callback: (x) => {
          if (x.status === 'progress' && x.file && x.total) {
            files[x.file] = [x.loaded || 0, x.total];
            let l = 0, t = 0;
            for (const k in files) { l += files[k][0]; t += files[k][1]; }
            self.postMessage({ id, progress: t ? l / t : 0 });
          }
        },
      });
      pipes.set(model, p);
    }
    const out = await (await p)(text, { max_new_tokens: 512 });
    self.postMessage({ id, text: (out && out[0] && out[0].translation_text) || '' });
  } catch (err) {
    pipes.delete(model);
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
`;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void; onProgress?: (p: number) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  worker = new Worker(url, { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; progress?: number; text?: string; error?: string }>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    if (typeof e.data.progress === 'number') {
      job.onProgress?.(e.data.progress);
      return;
    }
    pending.delete(e.data.id);
    if (e.data.error) job.reject(new Error(e.data.error));
    else job.resolve(e.data.text ?? '');
  };
  worker.onerror = () => {
    for (const j of pending.values()) j.reject(new Error('worker_failed'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function run(model: string, text: string, onProgress?: (p: number) => void): Promise<string> {
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, model, text });
  });
}

/** Planı uygula (önce consent kontrolü çağırandadır) */
export async function translateLocally(
  text: string,
  plan: { models: string[] },
  onProgress?: (p: number) => void,
): Promise<string> {
  let cur = text.slice(0, 2000);
  const n = plan.models.length;
  for (let i = 0; i < n; i++) {
    cur = await run(plan.models[i]!, cur, (p) => onProgress?.((i + p) / n));
  }
  return cur;
}
