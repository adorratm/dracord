import { useEffect, useState } from 'react';

type UpdaterStatus = {
  status:
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  version?: string;
  currentVersion?: string;
  percent?: number;
  message?: string;
};

/**
 * Electron auto-updater banner — mevcut / yeni sürüm + onay.
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const desktop = typeof window !== 'undefined' ? window.dracordDesktop : undefined;

  useEffect(() => {
    if (!desktop?.onUpdaterStatus) return;
    return desktop.onUpdaterStatus((payload) => {
      setStatus(payload as UpdaterStatus);
      if (payload.status === 'available' || payload.status === 'downloaded') {
        setDismissed(false);
      }
    });
  }, [desktop]);

  if (!desktop?.isElectron || !status || dismissed) return null;
  if (status.status === 'checking' || status.status === 'not-available') return null;

  const cur = status.currentVersion ?? '?';
  const next = status.version ?? '?';

  if (status.status === 'error') {
    return (
      <div className="fixed bottom-4 left-1/2 z-[100] w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-xl border border-error/40 bg-surface-container-high px-4 py-3 shadow-float">
        <p className="font-body-sm text-error">Güncelleme hatası: {status.message ?? 'bilinmiyor'}</p>
        <button
          type="button"
          className="mt-2 font-label-sm text-outline hover:text-on-surface"
          onClick={() => setDismissed(true)}
        >
          Kapat
        </button>
      </div>
    );
  }

  if (status.status === 'downloading') {
    const pct = Math.round(status.percent ?? 0);
    return (
      <div className="fixed bottom-4 left-1/2 z-[100] w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-xl border border-primary-container/40 bg-surface-container-high px-4 py-3 shadow-float">
        <p className="font-body-sm text-on-surface">
          Güncelleme indiriliyor… {pct}%
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full rounded-full bg-primary-container transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (status.status === 'available') {
    return (
      <div className="fixed bottom-4 left-1/2 z-[100] w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-xl border border-primary-container/40 bg-surface-container-high px-4 py-3 shadow-float">
        <p className="font-body-md text-on-surface">
          Yeni sürüm v{next} mevcut
        </p>
        <p className="mt-1 font-body-sm text-on-surface-variant">
          Mevcut sürüm: v{cur}. Güncellemek ister misin?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-8 rounded-lg bg-primary-container px-3 font-label-sm text-on-primary-container"
            onClick={() => void desktop.downloadUpdate?.()}
          >
            İndir
          </button>
          <button
            type="button"
            className="h-8 rounded-lg px-3 font-label-sm text-on-surface-variant hover:bg-surface-container"
            onClick={() => setDismissed(true)}
          >
            Sonra
          </button>
        </div>
      </div>
    );
  }

  if (status.status === 'downloaded') {
    return (
      <div className="fixed bottom-4 left-1/2 z-[100] w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-xl border border-primary-container/40 bg-surface-container-high px-4 py-3 shadow-float">
        <p className="font-body-md text-on-surface">
          v{next} indirildi
        </p>
        <p className="mt-1 font-body-sm text-on-surface-variant">
          Güncellemeyi uygulamak için uygulamayı yeniden başlat.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-8 rounded-lg bg-primary-container px-3 font-label-sm text-on-primary-container"
            onClick={() => void desktop.installUpdate?.()}
          >
            Güncelle ve yeniden başlat
          </button>
          <button
            type="button"
            className="h-8 rounded-lg px-3 font-label-sm text-on-surface-variant hover:bg-surface-container"
            onClick={() => setDismissed(true)}
          >
            Sonra
          </button>
        </div>
      </div>
    );
  }

  return null;
}
