'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { encodeVideoClipToGif, maxStickerDurationSec } from '../lib/video-to-sticker';

export interface VideoStickerTrimmerProps {
  open: boolean;
  onClose: () => void;
  /** Seçilen GIF kaydedildiğinde (data URL veya yüklenen uzak URL) */
  onSaved: (sticker: {
    dataUrl: string;
    blob: Blob;
    label: string;
    contentType: string;
  }) => void | Promise<void>;
  className?: string;
}

export function VideoStickerTrimmer({
  open,
  onClose,
  onSaved,
  className,
}: VideoStickerTrimmerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const maxDur = maxStickerDurationSec();
  const clipLen = useMemo(() => Math.max(0, end - start), [start, end]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewUrl(null);
      setError(null);
      setBusy(false);
      setProgress(0);
      setDuration(0);
      setStart(0);
      setEnd(5);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (!open) return null;

  const onPick = (f: File | null) => {
    setError(null);
    setPreviewUrl(null);
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      setError('Video dosyası seç');
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setObjectUrl(url);
  };

  const onMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    setStart(0);
    setEnd(Math.min(maxDur, d || 5));
  };

  const setStartSafe = (v: number) => {
    const s = Math.max(0, Math.min(v, duration));
    setStart(s);
    setEnd((e) => {
      let next = Math.max(s + 0.2, e);
      if (next - s > maxDur) next = s + maxDur;
      if (duration) next = Math.min(next, duration);
      return next;
    });
  };

  const setEndSafe = (v: number) => {
    let e = Math.max(0.2, Math.min(v, duration || v));
    if (e - start > maxDur) e = start + maxDur;
    if (e <= start) e = Math.min(start + 0.2, duration || start + 0.2);
    setEnd(e);
  };

  const encode = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { blob, dataUrl } = await encodeVideoClipToGif(file, {
        startSec: start,
        endSec: end,
        onProgress: setProgress,
      });
      setPreviewUrl(dataUrl);
      await onSaved({
        dataUrl,
        blob,
        label: file.name.replace(/\.[^.]+$/, '') || 'video-sticker',
        contentType: 'image/gif',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GIF oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('fixed inset-0 z-[120] flex items-center justify-center p-space-md', className)}>
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Kapat" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Videodan sticker"
        className="relative w-full max-w-md rounded-2xl bg-surface-container-high border border-surface-container-highest shadow-float p-space-lg"
      >
        <div className="flex items-center justify-between mb-space-md">
          <p className="font-headline-md text-on-surface">Videodan sticker</p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-bright flex items-center justify-center"
            aria-label="Kapat"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="font-body-sm text-on-surface-variant mb-space-md">
          En fazla {maxDur} sn kesit seç. GIF olarak kaydedilir.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full h-28 rounded-xl border border-dashed border-outline-variant/50 hover:bg-surface-bright flex flex-col items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[28px] text-outline">movie</span>
            <span className="font-label-md text-on-surface">Video seç</span>
          </button>
        ) : (
          <div className="space-y-space-md">
            <video
              ref={videoRef}
              src={objectUrl ?? undefined}
              className="w-full max-h-48 rounded-xl bg-black object-contain"
              muted
              playsInline
              onLoadedMetadata={onMeta}
              controls
            />
            <div className="space-y-2">
              <label className="block font-label-sm text-outline">
                Başlangıç ({start.toFixed(1)}s)
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={start}
                  onChange={(e) => setStartSafe(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <label className="block font-label-sm text-outline">
                Bitiş ({end.toFixed(1)}s)
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={end}
                  onChange={(e) => setEndSafe(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <p className="font-label-sm text-on-surface-variant">
                Kesit: {clipLen.toFixed(1)}s / max {maxDur}s
              </p>
            </div>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Önizleme" className="max-h-28 mx-auto object-contain" />
            )}
            {busy && (
              <div className="h-2 rounded-full bg-surface-container-lowest overflow-hidden">
                <div
                  className="h-full bg-primary-container transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex-1 h-10 rounded-lg bg-surface-container-lowest font-label-sm"
                disabled={busy}
              >
                Değiştir
              </button>
              <button
                type="button"
                onClick={() => void encode()}
                disabled={busy || clipLen <= 0}
                className="flex-1 h-10 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
              >
                {busy ? `Oluşturuluyor… ${Math.round(progress * 100)}%` : 'GIF kaydet'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-space-sm font-body-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
