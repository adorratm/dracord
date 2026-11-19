import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MessageAttachment, MessageDto } from '@dracord/types';
import { Modal } from '@dracord/ui';
import { clipStore } from '../lib/clip-store';
import { readClipDuration, trimClip } from '../lib/clip-trim';

const MAX_SHARE_BYTES = 50 * 1024 * 1024;

export type ClipShareClient = {
  uploadFile(file: File, folder?: string): Promise<MessageAttachment>;
  sendMessage(channelId: string, content: string, attachments?: MessageAttachment[]): Promise<MessageDto>;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;

/** Klip düzenleyici (C7): önizle, baş/son kırp, kaydet ya da bir kanala gönder */
export function ClipEditorHost({
  client,
  targets,
  defaultTargetId,
}: {
  client: ClipShareClient;
  targets: Array<{ id: string; label: string }>;
  defaultTargetId: string | null;
}) {
  const clip = useSyncExternalStore(clipStore.subscribe, () => clipStore.editing);
  const url = useMemo(() => (clip ? URL.createObjectURL(clip.blob) : null), [clip]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const vref = useRef<HTMLVideoElement>(null);
  const [dur, setDur] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [target, setTarget] = useState<string>('');
  const [caption, setCaption] = useState('');

  useEffect(() => {
    setDur(0);
    setMsg(null);
    setCaption('');
    setTarget(defaultTargetId && targets.some((t) => t.id === defaultTargetId) ? defaultTargetId : (targets[0]?.id ?? ''));
  }, [clip]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMeta = async () => {
    const v = vref.current;
    if (!v || !clip) return;
    const d = await readClipDuration(v, clip.seconds);
    setDur(d);
    setRange([0, d]);
  };

  // Önizleme aralıkta döner
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= range[1] - 0.05) v.currentTime = range[0];
      else if (v.currentTime < range[0] - 0.2) v.currentTime = range[0];
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [range]);

  if (!clip || !url) return null;
  const trimmed = dur > 0 && (range[0] > 0.15 || range[1] < dur - 0.15);
  const len = Math.max(0, range[1] - range[0]);

  const output = async (bitrate?: number): Promise<Blob> => {
    if (!trimmed && !bitrate) return clip.blob;
    setProgress(0);
    vref.current?.pause();
    return trimClip(clip.blob, range[0], range[1], { videoBitsPerSecond: bitrate, onProgress: setProgress });
  };

  const save = async () => {
    const d = window.dracordDesktop;
    if (!d?.saveClip) return;
    setBusy('Kırpılıyor…');
    setMsg(null);
    try {
      const blob = await output();
      const r = await d.saveClip(new Uint8Array(await blob.arrayBuffer()), `${clip.name}-kirpilmis`);
      if (!r.ok || !r.path) throw new Error(r.error || 'Kaydedilemedi');
      setMsg(`Kaydedildi: ${r.path}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!target) return;
    setBusy(trimmed ? 'Kırpılıyor…' : 'Hazırlanıyor…');
    setMsg(null);
    try {
      let blob = await output();
      // Büyükse düşük bit hızıyla yeniden kaydet (60 sn ≈ 19 MB)
      if (blob.size > MAX_SHARE_BYTES) {
        setBusy('Küçültülüyor…');
        blob = await output(2_500_000);
      }
      if (blob.size > MAX_SHARE_BYTES) throw new Error('Klip çok büyük — biraz daha kırp');
      setBusy('Yükleniyor…');
      const file = new File([blob], `${clip.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 40) || 'klip'}.webm`, { type: 'video/webm' });
      const att = await client.uploadFile(file);
      await client.sendMessage(target, caption.trim(), [att]);
      setMsg('Kanala gönderildi ✓');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setBusy(null);
    }
  };

  const field = 'rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';
  return (
    <Modal open title="Klip" onClose={() => !busy && clipStore.closeEditor()} className="sm:max-w-3xl">
      <div className="space-y-3">
        <video
          ref={vref}
          src={url}
          controls
          autoPlay
          muted
          onLoadedMetadata={() => void onMeta()}
          className="aspect-video w-full rounded-xl bg-black"
        />
        {dur > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between font-label-sm text-on-surface-variant">
              <span>Başlangıç {fmt(range[0])}</span>
              <span className="text-on-surface">{len.toFixed(1)} sn</span>
              <span>Bitiş {fmt(range[1])}</span>
            </div>
            <input
              type="range"
              aria-label="Başlangıç"
              min={0}
              max={dur}
              step={0.1}
              value={range[0]}
              disabled={!!busy}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), range[1] - 1);
                setRange([v, range[1]]);
                if (vref.current) vref.current.currentTime = v;
              }}
              className="w-full accent-primary"
            />
            <input
              type="range"
              aria-label="Bitiş"
              min={0}
              max={dur}
              step={0.1}
              value={range[1]}
              disabled={!!busy}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), range[0] + 1);
                setRange([range[0], v]);
                if (vref.current) vref.current.currentTime = Math.max(range[0], v - 2);
              }}
              className="w-full accent-primary"
            />
          </div>
        ) : (
          <p className="font-body-sm text-on-surface-variant">Süre okunuyor…</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!!busy || !trimmed}
            onClick={() => void save()}
            className="rounded-lg bg-surface-container-high px-3 py-2 font-label-md text-on-surface disabled:opacity-50"
            title={trimmed ? 'Kırpılmış kopyayı Klipler klasörüne kaydet' : 'Önce başı/sonu kırp'}
          >
            Kırpılmışı kaydet
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void window.dracordDesktop?.openClipsFolder?.(clip.path)}
            className="rounded-lg bg-surface-container-high px-3 py-2 font-label-md text-on-surface disabled:opacity-50"
          >
            Klasörde göster
          </button>
        </div>
        {targets.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/30 pt-3">
            <select className={field} value={target} onChange={(e) => setTarget(e.target.value)} disabled={!!busy} aria-label="Kanal">
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className={`${field} min-w-[10rem] flex-1`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              placeholder="Açıklama (isteğe bağlı)"
              disabled={!!busy}
            />
            <button
              type="button"
              disabled={!!busy || !target}
              onClick={() => void share()}
              className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary disabled:opacity-50"
            >
              Kanala gönder
            </button>
          </div>
        ) : null}
        {busy ? (
          <div className="space-y-1">
            <p className="font-body-sm text-on-surface-variant">{busy}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        ) : null}
        {msg ? <p className="break-all font-body-sm text-on-surface-variant">{msg}</p> : null}
      </div>
    </Modal>
  );
}
