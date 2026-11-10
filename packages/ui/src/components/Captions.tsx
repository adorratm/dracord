'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import type { VoiceCaptionsController } from '../lib/use-voice-captions';

/** A7 — sahnenin altında canlı altyazı satırları */
export function CaptionsOverlay({ ctl, className }: { ctl: VoiceCaptionsController; className?: string }) {
  if (!ctl.show || !ctl.lines.length) return null;
  return (
    <div className={cn('pointer-events-none absolute inset-x-0 bottom-16 z-[5] flex flex-col items-center gap-1 px-4', className)} aria-live="polite">
      {ctl.lines.slice(-3).map((l) => (
        <p key={l.key} className="max-w-3xl rounded-lg bg-black/70 px-3 py-1 text-center text-[15px] leading-snug text-white shadow">
          <span className="font-semibold text-[#8be9fd]">{l.name}: </span>
          <span className={l.final ? '' : 'opacity-80'}>{l.text}</span>
        </p>
      ))}
    </div>
  );
}

/** A7 — kontrol çubuğu: altyazıları göster / kendi konuşmanı altyazıla */
export function CaptionsButton({ ctl }: { ctl: VoiceCaptionsController }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  const m = ctl.mine;
  const active = ctl.show || m.kind === 'on';
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-9 px-3 rounded-full font-label-sm flex items-center gap-1.5 transition-colors',
          active ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface hover:bg-surface-bright',
        )}
        aria-expanded={open}
        title="Canlı altyazı"
      >
        <span className="material-symbols-outlined text-[18px]">closed_caption</span>
        Altyazı
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-72 space-y-3 rounded-xl border border-surface-container-highest bg-surface-container p-3 shadow-float">
          <label className="flex cursor-pointer items-start gap-2">
            <input type="checkbox" className="mt-1" checked={ctl.show} onChange={(e) => ctl.setShow(e.target.checked)} />
            <span>
              <span className="block font-label-md text-on-surface">Altyazıları göster</span>
              <span className="block font-body-sm text-on-surface-variant">Altyazıyı açan konuşmacıların sözleri ekranda görünür.</span>
            </span>
          </label>
          <div className="border-t border-outline-variant/40 pt-3">
            <p className="font-label-md text-on-surface">Konuşmamı altyazıla</p>
            <p className="mb-2 font-body-sm text-on-surface-variant">
              Sesin <strong>senin cihazında</strong> metne çevrilir; yalnız metin kanaldakilere gider, kaydedilmez. Susturunca durur.
            </p>
            {m.kind === 'off' ? (
              <button type="button" onClick={() => void ctl.startMine()} className="rounded-lg bg-primary px-3 py-1.5 font-label-md text-on-primary">
                Başlat
              </button>
            ) : m.kind === 'consent' ? (
              <div className="space-y-2">
                <p className="font-body-sm text-on-surface">
                  {m.engine === 'whisper'
                    ? `Bir kez ~${m.mb} MB konuşma tanıma modeli indirilecek (Whisper). Sonra tamamen cihazında çalışır.`
                    : 'Tarayıcın bir kez dil paketini indirecek. Sonra tamamen cihazında çalışır.'}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void ctl.startMine(true)} className="rounded-lg bg-primary px-3 py-1.5 font-label-md text-on-primary">
                    İndir ve başlat
                  </button>
                  <button type="button" onClick={ctl.cancelConsent} className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-on-surface">
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : m.kind === 'starting' ? (
              <p className="font-body-sm text-on-surface-variant">
                Hazırlanıyor{m.progress !== undefined && m.progress < 1 ? ` · model %${Math.round(m.progress * 100)}` : '…'}
              </p>
            ) : m.kind === 'on' ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-body-sm text-on-surface-variant">Açık · {m.engine === 'whisper' ? 'Whisper' : 'tarayıcı (cihaz üstü)'}</span>
                <button type="button" onClick={ctl.stopMine} className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-error">
                  Durdur
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-body-sm text-error">{m.message}</p>
                <button type="button" onClick={ctl.stopMine} className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-on-surface">
                  Tamam
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
