import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@dracord/ui';

export type DesktopCaptureSource = {
  id: string;
  name: string;
  displayId: string;
  thumbnail: string;
  appIcon: string | null;
  kind: 'screen' | 'window';
};

export type ScreenShareSelection = {
  sourceId: string;
  systemAudio: boolean;
};

type Props = {
  open: boolean;
  sources: DesktopCaptureSource[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (selection: ScreenShareSelection) => void;
};

export function ScreenSharePicker({
  open,
  sources,
  loading,
  onCancel,
  onConfirm,
}: Props) {
  const screens = useMemo(() => sources.filter((s) => s.kind === 'screen'), [sources]);
  const windows = useMemo(() => sources.filter((s) => s.kind === 'window'), [sources]);
  const [tab, setTab] = useState<'screen' | 'window'>('screen');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [systemAudio, setSystemAudio] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTab(screens.length ? 'screen' : 'window');
    setSelectedId(screens[0]?.id ?? windows[0]?.id ?? null);
    setSystemAudio(true);
  }, [open, screens, windows]);

  const list = tab === 'screen' ? screens : windows;

  return (
    <Modal open={open} title="Ekran paylaş" onClose={onCancel}>
      <p className="text-sm text-on-surface-variant mb-3">
        Paylaşılacak ekranı veya pencereyi seç. Tarayıcı pencereleri de listelenir.
      </p>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          className={`h-8 px-3 rounded-md text-sm ${
            tab === 'screen'
              ? 'bg-primary-container text-on-primary-container'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
          onClick={() => setTab('screen')}
        >
          Ekranlar ({screens.length})
        </button>
        <button
          type="button"
          className={`h-8 px-3 rounded-md text-sm ${
            tab === 'window'
              ? 'bg-primary-container text-on-primary-container'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
          onClick={() => setTab('window')}
        >
          Pencereler ({windows.length})
        </button>
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm text-outline">Kaynaklar yükleniyor…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto mb-3">
          {list.length === 0 && (
            <li className="col-span-2 py-8 text-center text-sm text-outline">
              {tab === 'screen' ? 'Ekran bulunamadı' : 'Pencere bulunamadı'}
            </li>
          )}
          {list.map((s) => {
            const active = selectedId === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left rounded-lg overflow-hidden border transition-colors ${
                    active
                      ? 'border-primary bg-primary-container/20'
                      : 'border-outline-variant/40 hover:border-outline'
                  }`}
                >
                  <div className="aspect-video bg-surface-container-highest relative">
                    {s.thumbnail ? (
                      <img
                        src={s.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    {s.appIcon ? (
                      <img
                        src={s.appIcon}
                        alt=""
                        className="absolute bottom-1 left-1 w-5 h-5 rounded"
                      />
                    ) : null}
                  </div>
                  <div className="px-2 py-1.5 text-xs text-on-surface truncate">{s.name}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <label className="flex items-center gap-2 mb-4 text-sm text-on-surface cursor-pointer select-none">
        <input
          type="checkbox"
          checked={systemAudio}
          onChange={(e) => setSystemAudio(e.target.checked)}
          className="rounded"
        />
        Sistem sesini de paylaş (uygulama sesleri)
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 h-10 rounded-lg bg-surface-container-high text-on-surface-variant"
          onClick={onCancel}
        >
          İptal
        </button>
        <button
          type="button"
          disabled={!selectedId || loading}
          className="flex-1 h-10 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          onClick={() => {
            if (!selectedId) return;
            onConfirm({ sourceId: selectedId, systemAudio });
          }}
        >
          Paylaş
        </button>
      </div>
    </Modal>
  );
}
