/**
 * A7 — cihaz üstü konuşma tanıma (sunucu maliyeti yok, ses cihazdan çıkmaz).
 *  1) Chrome/Edge masaüstü: Web Speech API `processLocally: true` (SODA dil paketi)
 *  2) Diğerleri (Electron, Firefox): Whisper (transformers.js, jsDelivr) Web Worker'da
 * Bulut tanıma ASLA kullanılmaz.
 */

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const WHISPER_MODEL = 'Xenova/whisper-base';
export const WHISPER_DOWNLOAD_MB = 80;
const CONSENT_KEY = 'dracord:whisper-ok';

export type CaptionEngine = 'webspeech' | 'whisper';
export type CaptionEmit = (c: { id: string; text: string; final: boolean }) => void;

const LANG_NAME: Record<string, string> = {
  tr: 'turkish', en: 'english', de: 'german', fr: 'french', es: 'spanish', it: 'italian', ru: 'russian',
  ar: 'arabic', nl: 'dutch', ja: 'japanese', zh: 'chinese', az: 'azerbaijani', ku: 'kurdish',
};
const BCP47: Record<string, string> = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA', nl: 'nl-NL', ja: 'ja-JP' };

type SRStatic = {
  new (): SRInstance;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};
type SRInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function SR(): SRStatic | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRStatic; webkitSpeechRecognition?: SRStatic };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Hangi motor kullanılabilir (yalnız cihaz üstü) */
export async function pickCaptionEngine(lang: string): Promise<{ engine: CaptionEngine | null; needsDownload: boolean }> {
  const S = SR();
  // Electron'da Chrome bileşen güncelleyicisi (SODA) yok → doğrudan Whisper
  const electron = typeof window !== 'undefined' && Boolean((window as unknown as { dracordDesktop?: unknown }).dracordDesktop);
  if (S?.available && !electron) {
    try {
      const st = await S.available({ langs: [BCP47[lang] ?? lang], processLocally: true });
      if (st === 'available') return { engine: 'webspeech', needsDownload: false };
      if (st === 'downloadable' || st === 'downloading') return { engine: 'webspeech', needsDownload: true };
    } catch {
      /* düş */
    }
  }
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined' || typeof AudioContext === 'undefined') {
    return { engine: null, needsDownload: false };
  }
  return { engine: 'whisper', needsDownload: !whisperConsented() };
}

export function whisperConsented() {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Ortak arayüz */
export interface CaptionSession {
  engine: CaptionEngine;
  setPaused(p: boolean): void;
  stop(): void;
}

let seq = 0;
const nid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

// ── 1) Web Speech (on-device) ──
async function startWebSpeech(lang: string, emit: CaptionEmit, onError: (m: string) => void): Promise<CaptionSession> {
  const S = SR()!;
  const tag = BCP47[lang] ?? lang;
  if (S.install) {
    const st = await S.available?.({ langs: [tag], processLocally: true });
    if (st !== 'available') {
      const ok = await S.install({ langs: [tag], processLocally: true });
      if (!ok) throw new Error('Dil paketi kurulamadı');
    }
  }
  let stopped = false;
  let paused = false;
  let rec: SRInstance | null = null;
  const ids = new Map<number, string>();
  const boot = () => {
    if (stopped || paused) return;
    const r = new S();
    r.lang = tag;
    r.continuous = true;
    r.interimResults = true;
    r.processLocally = true;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = res[0]?.transcript?.trim();
        if (!text) continue;
        let id = ids.get(i);
        if (!id) {
          id = nid();
          ids.set(i, id);
        }
        emit({ id, text, final: res.isFinal });
      }
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'language-not-supported' || e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopped = true;
        onError(e.error === 'not-allowed' ? 'Mikrofon izni gerekli' : 'Bu dil cihazda desteklenmiyor');
      }
    };
    r.onend = () => {
      ids.clear();
      rec = null;
      if (!stopped && !paused) setTimeout(boot, 250);
    };
    rec = r;
    try {
      r.start();
    } catch {
      /* zaten başlamış */
    }
  };
  boot();
  return {
    engine: 'webspeech',
    setPaused(p) {
      paused = p;
      if (p) rec?.abort();
      else if (!rec) boot();
    },
    stop() {
      stopped = true;
      rec?.abort();
    },
  };
}

// ── 2) Whisper (Web Worker) ──
const WORKER_SRC = `
import { pipeline, env } from '${TRANSFORMERS_URL}';
env.allowLocalModels = false;
let asr = null;
self.onmessage = async (e) => {
  const { id, audio, language } = e.data;
  try {
    if (!asr) {
      const files = {};
      asr = pipeline('automatic-speech-recognition', '${WHISPER_MODEL}', {
        dtype: 'q8',
        progress_callback: (x) => {
          if (x.status === 'progress' && x.file && x.total) {
            files[x.file] = [x.loaded || 0, x.total];
            let l = 0, t = 0;
            for (const k in files) { l += files[k][0]; t += files[k][1]; }
            self.postMessage({ progress: t ? l / t : 0 });
          }
        },
      });
    }
    const p = await asr;
    if (!audio) { self.postMessage({ id, ready: true }); return; }
    const out = await p(audio, { language: language || null, task: 'transcribe', chunk_length_s: 30 });
    self.postMessage({ id, text: (out && out.text) || '' });
  } catch (err) {
    asr = null;
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
`;

/** Whisper'ın sık uydurduğu boş/sessiz çıktılar */
const HALLUCINATION = /^(\[.*\]|\(.*\)|altyazı.*|abone ol.*|thanks? for watching.*|you|\.+|♪+)$/i;

async function startWhisper(
  lang: string,
  emit: CaptionEmit,
  onError: (m: string) => void,
  onProgress?: (p: number) => void,
): Promise<CaptionSession> {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    /* ignore */
  }
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  const worker = new Worker(url, { type: 'module' });
  let busy = false;
  const queue: Float32Array[] = [];
  worker.onmessage = (e: MessageEvent<{ id?: string; text?: string; error?: string; progress?: number; ready?: boolean }>) => {
    if (typeof e.data.progress === 'number') {
      onProgress?.(e.data.progress);
      return;
    }
    busy = false;
    if (e.data.error) onError('Konuşma tanıma hatası');
    const text = (e.data.text ?? '').trim();
    if (text && !HALLUCINATION.test(text) && e.data.id) emit({ id: e.data.id, text, final: true });
    pump();
  };
  const pump = () => {
    if (busy || !queue.length) return;
    // Gecikme birikmesin: kuyrukta 3'ten fazla parça varsa eskileri at
    while (queue.length > 3) queue.shift();
    busy = true;
    const audio = queue.shift()!;
    worker.postMessage({ id: nid(), audio, language: LANG_NAME[lang] ?? null }, [audio.buffer]);
  };
  // Modeli önceden yükle
  busy = true;
  worker.postMessage({ id: 'warm', audio: null, language: null });

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const ctx = new AudioContext({ sampleRate: 16000 });
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const rate = ctx.sampleRate;
  let paused = false;
  let noise = 0.008;
  let voiced = false;
  let silenceMs = 0;
  let buf: Float32Array[] = [];
  let len = 0;
  const flush = () => {
    if (len >= rate * 0.6) {
      const out = new Float32Array(len);
      let o = 0;
      for (const b of buf) {
        out.set(b, o);
        o += b.length;
      }
      queue.push(out);
      pump();
    }
    buf = [];
    len = 0;
    voiced = false;
    silenceMs = 0;
  };
  proc.onaudioprocess = (ev) => {
    if (paused) return;
    const x = ev.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < x.length; i++) sum += x[i]! * x[i]!;
    const rms = Math.sqrt(sum / x.length);
    const blockMs = (x.length / rate) * 1000;
    const speech = rms > Math.max(0.012, noise * 3);
    if (!speech) noise = noise * 0.95 + rms * 0.05;
    if (speech) {
      voiced = true;
      silenceMs = 0;
    } else if (voiced) silenceMs += blockMs;
    if (voiced) {
      buf.push(new Float32Array(x));
      len += x.length;
    }
    if (voiced && (silenceMs >= 700 || len >= rate * 10)) flush();
  };
  src.connect(proc);
  proc.connect(ctx.destination);
  return {
    engine: 'whisper',
    setPaused(p) {
      paused = p;
      if (p) {
        buf = [];
        len = 0;
        voiced = false;
      }
    },
    stop() {
      try {
        proc.disconnect();
        src.disconnect();
      } catch {
        /* ignore */
      }
      for (const t of stream.getTracks()) t.stop();
      void ctx.close().catch(() => undefined);
      worker.terminate();
      URL.revokeObjectURL(url);
    },
  };
}

export async function startCaptions(
  lang: string,
  emit: CaptionEmit,
  opts: { onError: (m: string) => void; onProgress?: (p: number) => void; prefer?: CaptionEngine | null },
): Promise<CaptionSession> {
  const pick = opts.prefer ? { engine: opts.prefer } : await pickCaptionEngine(lang);
  if (pick.engine === 'webspeech') return startWebSpeech(lang, emit, opts.onError);
  if (pick.engine === 'whisper') return startWhisper(lang, emit, opts.onError, opts.onProgress);
  throw new Error('Bu cihazda konuşma tanıma yok');
}
