import { useState, useSyncExternalStore } from 'react';
import { standaloneClip } from '../lib/standalone-clip';
import { ScreenSharePicker, type DesktopCaptureSource } from './ScreenSharePicker';

let openPicker: (() => void) | null = null;
/** Ayarlar vb. yerlerden bağımsız klibi başlat (kaynak seçici açılır) */
export function startStandaloneClip() {
  openPicker?.();
}

/** Bağımsız klip (C7): kaynak seçici + sağ altta küçük durum çipi */
export function StandaloneClipChip() {
  const st = useSyncExternalStore(standaloneClip.subscribe, () => standaloneClip.state);
  const [picker, setPicker] = useState<{ sources: DesktopCaptureSource[]; loading: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  openPicker = () => {
    const d = window.dracordDesktop;
    if (!d?.getDesktopSources) return;
    setErr(null);
    setPicker({ sources: [], loading: true });
    void d
      .getDesktopSources()
      .then((sources) => setPicker({ sources, loading: false }))
      .catch(() => {
        setPicker(null);
        setErr('Pencereler listelenemedi');
      });
  };

  const pickerEl = (
    <ScreenSharePicker
      open={!!picker}
      sources={picker?.sources ?? []}
      loading={picker?.loading}
      onCancel={() => setPicker(null)}
      onConfirm={(sel) => {
        const name = picker?.sources.find((s) => s.id === sel.sourceId)?.name ?? 'klip';
        setPicker(null);
        void standaloneClip.start({ ...sel, name }).catch((e) => setErr(e instanceof Error ? e.message : 'Yakalama başlatılamadı'));
      }}
    />
  );

  if (st.kind === 'off') {
    return (
      <>
        {pickerEl}
        {err ? (
          <div role="alert" className="fixed bottom-4 right-4 z-[180] rounded-xl bg-error-container px-3 py-2 font-body-sm text-on-error-container shadow-lg">
            {err}
          </div>
        ) : null}
      </>
    );
  }
  const ready = st.seconds >= 3 && !st.saving;
  return (
    <>
      {pickerEl}
      <div className="fixed bottom-4 right-4 z-[180] flex max-w-[22rem] items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high py-1 pl-3 pr-1 shadow-lg">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-label-sm text-on-surface" title={st.name}>
          {st.error ? st.error : st.last && !st.saving ? `${st.last.seconds} sn kaydedildi` : `Klip · ${st.name}`}
        </span>
        {st.last && !st.saving ? (
          <button
            type="button"
            onClick={() => standaloneClip.edit()}
            className="rounded-full px-2 py-1 font-label-sm text-primary hover:bg-surface-bright"
            title="Kırp ya da kanala gönder"
          >
            Düzenle
          </button>
        ) : null}
        <button
          type="button"
          disabled={!ready}
          onClick={() => void standaloneClip.save()}
          className="rounded-full bg-primary px-3 py-1 font-label-sm text-on-primary disabled:opacity-50"
          title={st.accelerator ? 'Son 30–60 sn (Ctrl+Shift+K)' : 'Son 30–60 sn'}
        >
          {st.saving ? '…' : `Kaydet · ${Math.min(st.seconds, 60)} sn`}
        </button>
        <button
          type="button"
          onClick={() => standaloneClip.stop()}
          className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-bright"
          aria-label="Klip yakalamayı durdur"
          title="Durdur"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </>
  );
}
