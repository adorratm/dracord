import { useClipRecorder } from '../hooks/useClipRecorder';

/** Ses sahnesi kontrol çubuğu: ekran paylaşımı varken anlık klip (A3) */
export function ClipButton({
  shareKey,
  shareName,
  getStream,
}: {
  shareKey: string | null;
  shareName: string;
  getStream: () => MediaStream | null;
}) {
  const clip = useClipRecorder(shareKey, shareName, getStream);
  if (!clip.supported || !shareKey) return null;
  const s = clip.state;
  const base = 'h-9 px-3 rounded-full font-label-sm flex items-center gap-1.5 transition-colors';

  if (s.kind === 'off' || s.kind === 'error') {
    return (
      <button
        type="button"
        onClick={() => void clip.arm()}
        className={`${base} bg-surface-container-high text-on-surface hover:bg-surface-bright`}
        title={s.kind === 'error' ? s.message : 'Bu paylaşım için klip arabelleğini aç (son 30–60 sn kaydedilir)'}
      >
        <span className="material-symbols-outlined text-[18px]">movie</span>
        {s.kind === 'error' ? 'Klip: hata' : 'Klip'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={s.kind === 'saving' || (s.kind === 'armed' && s.seconds < 3)}
        onClick={() => (s.kind === 'saved' ? clip.openFolder(s.path) : void clip.save())}
        className={`${base} bg-primary-container text-on-primary-container disabled:opacity-60`}
        title={s.kind === 'armed' ? `Klibi kaydet${s.accelerator ? ' (Ctrl+Shift+K)' : ''}` : undefined}
      >
        <span className="material-symbols-outlined text-[18px]">{s.kind === 'saved' ? 'folder_open' : 'fiber_manual_record'}</span>
        {s.kind === 'saving'
          ? 'Kaydediliyor…'
          : s.kind === 'saved'
            ? `${s.seconds} sn kaydedildi · aç`
            : `Klibi kaydet · ${Math.min(s.seconds, 60)} sn`}
      </button>
      <button
        type="button"
        onClick={clip.disarm}
        className="h-9 w-9 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-bright flex items-center justify-center"
        aria-label="Klip arabelleğini kapat"
        title="Klip arabelleğini kapat"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
