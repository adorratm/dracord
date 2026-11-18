'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MediaGalleryItem, MediaGalleryKind, MediaGalleryPage } from '@dracord/types';
import { cn } from '../lib/cn';
import { Modal } from './Modal';

export interface MediaGalleryClient {
  listChannelMedia(channelId: string, kind: MediaGalleryKind, before?: string | null): Promise<MediaGalleryPage>;
}

const TABS: Array<{ id: MediaGalleryKind; label: string }> = [
  { id: 'image', label: 'Görseller' },
  { id: 'video', label: 'Videolar' },
  { id: 'file', label: 'Dosyalar' },
];

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const day = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
};

/** G1 — every image, video and file shared in the channel; click one to jump to its message */
export function MediaGalleryModal({
  client,
  channelId,
  channelName,
  open,
  onClose,
  onJump,
}: {
  client: MediaGalleryClient;
  channelId: string;
  channelName?: string;
  open: boolean;
  onClose: () => void;
  onJump?: (messageId: string) => void;
}) {
  const [tab, setTab] = useState<MediaGalleryKind>('image');
  const [items, setItems] = useState<MediaGalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaGalleryItem | null>(null);

  const load = useCallback(
    async (kind: MediaGalleryKind, before: string | null, reset: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const page = await client.listChannelMedia(channelId, kind, before);
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setCursor(page.nextCursor);
        setDone(!page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Yüklenemedi');
      } finally {
        setBusy(false);
      }
    },
    [client, channelId],
  );

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setCursor(null);
    setDone(false);
    void load(tab, null, true);
  }, [open, tab, load]);

  return (
    <Modal open={open} title={channelName ? `#${channelName} · medya` : 'Medya'} onClose={onClose} className="sm:max-w-3xl">
      <div className="flex gap-1 mb-space-sm" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg font-label-md',
              tab === t.id ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-h-[65vh] overflow-y-auto pr-1">
        {tab === 'file' ? (
          <ul className="divide-y divide-surface-container-high">
            {items.map((it) => (
              <li key={`${it.messageId}:${it.attachment.id}`} className="flex items-center gap-3 py-2">
                <span className="material-symbols-outlined text-outline">description</span>
                <div className="min-w-0 flex-1">
                  <a href={it.attachment.url} target="_blank" rel="noopener noreferrer" className="block truncate font-body-md text-primary hover:underline">
                    {it.attachment.filename}
                  </a>
                  <p className="font-body-sm text-outline">
                    {size(it.attachment.size)} · {it.authorName} · {day(it.createdAt)}
                  </p>
                </div>
                {onJump ? (
                  <button type="button" className="font-label-sm text-on-surface-variant hover:text-on-surface" onClick={() => onJump(it.messageId)}>
                    Mesaja git
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {items.map((it) => (
              <button
                key={`${it.messageId}:${it.attachment.id}`}
                type="button"
                onClick={() => setPreview(it)}
                className="relative aspect-square overflow-hidden rounded-lg bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`${it.attachment.filename} — ${it.authorName}`}
              >
                {tab === 'image' ? (
                  <img src={it.attachment.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <video src={it.attachment.url} preload="metadata" muted className="h-full w-full object-cover" />
                    <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-white text-[36px] drop-shadow">play_circle</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
        {!busy && items.length === 0 && !error ? (
          <p className="py-space-lg text-center font-body-sm text-on-surface-variant">Bu kanalda henüz {TABS.find((t) => t.id === tab)?.label.toLocaleLowerCase('tr')} yok.</p>
        ) : null}
        {error ? <p className="py-2 font-body-sm text-error">{error}</p> : null}
        {!done && items.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(tab, cursor, false)}
            className="mt-space-sm w-full h-9 rounded-lg bg-surface-container-high font-label-md text-on-surface disabled:opacity-50"
          >
            {busy ? 'Yükleniyor…' : 'Daha fazla'}
          </button>
        ) : null}
        {busy && items.length === 0 ? <p className="py-space-lg text-center font-body-sm text-outline">Yükleniyor…</p> : null}
      </div>
      {preview ? (
        <div className="fixed inset-0 z-[120] bg-black/85 flex flex-col items-center justify-center p-4" role="dialog" aria-label="Önizleme" onClick={() => setPreview(null)}>
          <div className="max-h-[80vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            {tab === 'image' ? (
              <img src={preview.attachment.url} alt={preview.attachment.filename} className="max-h-[80vh] max-w-[92vw] object-contain rounded-lg" />
            ) : (
              <video src={preview.attachment.url} controls autoPlay className="max-h-[80vh] max-w-[92vw] rounded-lg" />
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 text-white/90 font-body-sm" onClick={(e) => e.stopPropagation()}>
            <span>
              {preview.authorName} · {day(preview.createdAt)}
            </span>
            <a href={preview.attachment.url} target="_blank" rel="noopener noreferrer" className="underline">
              Aç
            </a>
            {onJump ? (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  const id = preview.messageId;
                  setPreview(null);
                  onJump(id);
                }}
              >
                Mesaja git
              </button>
            ) : null}
            <button type="button" className="underline" onClick={() => setPreview(null)}>
              Kapat
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
