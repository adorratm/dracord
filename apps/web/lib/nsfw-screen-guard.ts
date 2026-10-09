/**
 * Ekran / kamera yayını için istemci tarafı NSFW tarayıcı.
 * nsfwjs (MobileNet) — porn/hentai skoruna göre engel.
 */

export type NsfwLabelScores = {
  Drawing: number;
  Hentai: number;
  Neutral: number;
  Porn: number;
  Sexy: number;
};

export type NsfwVerdict = {
  blocked: boolean;
  score: number;
  labels: NsfwLabelScores;
  reason: 'porn' | 'hentai' | 'combo' | 'sexy' | 'clear';
};

const EMPTY_LABELS: NsfwLabelScores = {
  Drawing: 0,
  Hentai: 0,
  Neutral: 1,
  Porn: 0,
  Sexy: 0,
};

/** Tek sınıf eşikleri */
const PORN_THRESHOLD = 0.55;
const HENTAI_THRESHOLD = 0.55;
const SEXY_THRESHOLD = 0.9;
/** Porn+Hentai+Sexy toplamı */
const COMBO_THRESHOLD = 0.72;

/** Ardışık pozitif kare (yanlış pozitif azaltır) */
const HITS_TO_BLOCK = 2;

/** Örnekleme aralığı */
export const NSFW_SAMPLE_INTERVAL_MS = 1200;

/** Engelden sonra yeniden paylaşım bekleme */
export const NSFW_RESHARE_COOLDOWN_MS = 15_000;

type NsfwModel = {
  classify: (
    input: ImageData | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    topk?: number,
  ) => Promise<Array<{ className: string; probability: number }>>;
};

let modelPromise: Promise<NsfwModel> | null = null;

async function getModel(): Promise<NsfwModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      // tfjs önce yüklenmeli (nsfwjs peer)
      await import('@tensorflow/tfjs');
      const nsfwjs = await import('nsfwjs');
      return nsfwjs.load() as Promise<NsfwModel>;
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

function scoresFromPredictions(
  preds: Array<{ className: string; probability: number }>,
): NsfwLabelScores {
  const labels = { ...EMPTY_LABELS };
  for (const p of preds) {
    const key = p.className as keyof NsfwLabelScores;
    if (key in labels) labels[key] = p.probability;
  }
  return labels;
}

export function evaluateNsfwScores(labels: NsfwLabelScores): NsfwVerdict {
  const combo = labels.Porn + labels.Hentai + labels.Sexy * 0.5;
  if (labels.Porn >= PORN_THRESHOLD) {
    return { blocked: true, score: labels.Porn, labels, reason: 'porn' };
  }
  if (labels.Hentai >= HENTAI_THRESHOLD) {
    return { blocked: true, score: labels.Hentai, labels, reason: 'hentai' };
  }
  if (combo >= COMBO_THRESHOLD) {
    return { blocked: true, score: combo, labels, reason: 'combo' };
  }
  if (labels.Sexy >= SEXY_THRESHOLD) {
    return { blocked: true, score: labels.Sexy, labels, reason: 'sexy' };
  }
  return {
    blocked: false,
    score: Math.max(labels.Porn, labels.Hentai, labels.Sexy),
    labels,
    reason: 'clear',
  };
}

async function grabFrameBitmap(track: MediaStreamTrack): Promise<ImageBitmap | null> {
  try {
    if (typeof ImageCapture !== 'undefined') {
      const capture = new ImageCapture(track);
      return await capture.grabFrame();
    }
  } catch {
    // fallback below
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  try {
    await video.play();
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) resolve();
      else video.onloadeddata = () => resolve();
    });
    if (video.videoWidth < 8 || video.videoHeight < 8) return null;
    return await createImageBitmap(video);
  } catch {
    return null;
  } finally {
    try {
      video.pause();
      video.srcObject = null;
    } catch {
      // ignore
    }
  }
}

function downscaleBitmap(bitmap: ImageBitmap, maxSide = 224): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

export async function classifyMediaTrack(
  track: MediaStreamTrack,
): Promise<NsfwVerdict | null> {
  if (track.readyState !== 'live' || track.kind !== 'video') return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await grabFrameBitmap(track);
    if (!bitmap) return null;
    const canvas = downscaleBitmap(bitmap);
    const model = await getModel();
    const preds = await model.classify(canvas, 5);
    return evaluateNsfwScores(scoresFromPredictions(preds));
  } catch (err) {
    console.warn('[nsfw-guard] classify failed', err);
    return null;
  } finally {
    try {
      bitmap?.close();
    } catch {
      // ignore
    }
  }
}

export async function classifyVideoElement(
  video: HTMLVideoElement,
): Promise<NsfwVerdict | null> {
  if (video.readyState < 2 || video.videoWidth < 8) return null;
  try {
    const bitmap = await createImageBitmap(video);
    try {
      const canvas = downscaleBitmap(bitmap);
      const model = await getModel();
      const preds = await model.classify(canvas, 5);
      return evaluateNsfwScores(scoresFromPredictions(preds));
    } finally {
      bitmap.close();
    }
  } catch (err) {
    console.warn('[nsfw-guard] video classify failed', err);
    return null;
  }
}

/** Mesaj / DM görüntü ekleri için */
export async function classifyImageElement(
  img: HTMLImageElement,
): Promise<NsfwVerdict | null> {
  if (!img.naturalWidth || !img.complete) return null;
  try {
    const bitmap = await createImageBitmap(img);
    try {
      const canvas = downscaleBitmap(bitmap);
      const model = await getModel();
      const preds = await model.classify(canvas, 5);
      return evaluateNsfwScores(scoresFromPredictions(preds));
    } finally {
      bitmap.close();
    }
  } catch (err) {
    console.warn('[nsfw-guard] image classify failed', err);
    return null;
  }
}

export async function classifyImageUrl(url: string): Promise<NsfwVerdict | null> {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      void classifyImageElement(img).then(resolve);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function nsfwBlockMessage(source: 'screen' | 'camera' | 'view'): string {
  if (source === 'view') {
    return 'Uygunsuz içerik tespit edildi — izleme durduruldu.';
  }
  if (source === 'camera') {
    return 'Uygunsuz içerik tespit edildi — kamera yayını otomatik kapatıldı.';
  }
  return 'Uygunsuz içerik tespit edildi — ekran paylaşımı otomatik durduruldu.';
}

export type NsfwMonitorHandle = { stop: () => void };

/**
 * Yerel video track’i periyodik tarar; eşik aşılınca onBlocked.
 */
export function startNsfwTrackMonitor(opts: {
  getTrack: () => MediaStreamTrack | null | undefined;
  onBlocked: (verdict: NsfwVerdict) => void;
  intervalMs?: number;
  /** Model önceden ısınsın */
  warmup?: boolean;
}): NsfwMonitorHandle {
  let stopped = false;
  let hits = 0;
  let timer: number | null = null;
  let inFlight = false;

  if (opts.warmup !== false) {
    void getModel().catch(() => undefined);
  }

  const tick = async () => {
    if (stopped || inFlight) return;
    const track = opts.getTrack();
    if (!track || track.readyState !== 'live') {
      hits = 0;
      return;
    }
    inFlight = true;
    try {
      const verdict = await classifyMediaTrack(track);
      if (stopped) return;
      // Fail-closed: tarama başarısız / model yok → ardışık hatalarda engelle
      if (!verdict) {
        hits += 1;
        if (hits >= HITS_TO_BLOCK + 1) {
          hits = 0;
          opts.onBlocked({
            blocked: true,
            score: 1,
            labels: EMPTY_LABELS,
            reason: 'combo',
          });
        }
        return;
      }
      if (verdict.blocked) {
        hits += 1;
        if (hits >= HITS_TO_BLOCK) {
          hits = 0;
          opts.onBlocked(verdict);
        }
      } else {
        hits = 0;
      }
    } finally {
      inFlight = false;
    }
  };

  const interval = opts.intervalMs ?? NSFW_SAMPLE_INTERVAL_MS;
  // İlk tarama biraz gecikmeli (track stabilize)
  timer = window.setTimeout(() => {
    void tick();
    timer = window.setInterval(() => void tick(), interval);
  }, 800);

  return {
    stop: () => {
      stopped = true;
      if (timer != null) {
        window.clearTimeout(timer);
        window.clearInterval(timer);
        timer = null;
      }
    },
  };
}
