/** Client-side video → animated GIF sticker (max 15s). Uses gifenc. */

/// <reference path="../types/gifenc.d.ts" />
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const MAX_DURATION_SEC = 15;
const MAX_OUTPUT_BYTES = 2_800_000;
const DEFAULT_FPS = 10;
const MAX_EDGE = 320;

export type VideoStickerEncodeOptions = {
  startSec: number;
  endSec: number;
  fps?: number;
  maxEdge?: number;
  onProgress?: (ratio: number) => void;
};

function clampRange(start: number, end: number, duration: number) {
  const s = Math.max(0, Math.min(start, duration));
  let e = Math.max(s + 0.1, Math.min(end, duration));
  if (e - s > MAX_DURATION_SEC) e = s + MAX_DURATION_SEC;
  return { start: s, end: e };
}

export function maxStickerDurationSec() {
  return MAX_DURATION_SEC;
}

export async function encodeVideoClipToGif(
  file: File,
  opts: VideoStickerEncodeOptions,
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Yalnızca video dosyası seçilebilir');
  }

  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video yüklenemedi'));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : opts.endSec;
    const { start, end } = clampRange(opts.startSec, opts.endSec, duration);
    const fps = opts.fps ?? DEFAULT_FPS;
    let maxEdge = opts.maxEdge ?? MAX_EDGE;

    const tryEncode = async (edge: number, frameFps: number) => {
      const scale = Math.min(1, edge / Math.max(video.videoWidth, video.videoHeight, 1));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas desteklenmiyor');

      const totalFrames = Math.max(1, Math.ceil((end - start) * frameFps));
      const delay = Math.round(1000 / frameFps);
      const gif = GIFEncoder();
      let palette: number[][] | null = null;

      for (let i = 0; i < totalFrames; i++) {
        const t = start + (i / frameFps);
        video.currentTime = Math.min(t, end - 0.001);
        await new Promise<void>((resolve, reject) => {
          const onSeek = () => {
            video.removeEventListener('seeked', onSeek);
            resolve();
          };
          video.addEventListener('seeked', onSeek);
          window.setTimeout(() => {
            video.removeEventListener('seeked', onSeek);
            reject(new Error('Video seek zaman aşımı'));
          }, 8000);
        });
        ctx.drawImage(video, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        const format = 'rgb444' as const;
        if (!palette) {
          palette = quantize(data, 256, { format });
        }
        const index = applyPalette(data, palette, format);
        gif.writeFrame(index, width, height, {
          palette: i === 0 ? palette : undefined,
          delay,
        });
        opts.onProgress?.(i / totalFrames);
        await new Promise((r) => setTimeout(r, 0));
      }

      gif.finish();
      const bytes = gif.bytes();
      return { bytes, width, height };
    };

    let result = await tryEncode(maxEdge, fps);
    // Boyut limiti aşılırsa çözünürlük / fps düşür
    if (result.bytes.byteLength > MAX_OUTPUT_BYTES) {
      result = await tryEncode(Math.floor(maxEdge * 0.7), Math.max(6, Math.floor(fps * 0.7)));
    }
    if (result.bytes.byteLength > MAX_OUTPUT_BYTES) {
      result = await tryEncode(Math.floor(maxEdge * 0.5), 6);
    }
    if (result.bytes.byteLength > MAX_OUTPUT_BYTES) {
      throw new Error('GIF 2.8 MB sınırını aşıyor — daha kısa bir kesit seç');
    }

    const blob = new Blob([Uint8Array.from(result.bytes)], { type: 'image/gif' });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('GIF okunamadı'));
      reader.readAsDataURL(blob);
    });
    opts.onProgress?.(1);
    return { blob, dataUrl, width: result.width, height: result.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
