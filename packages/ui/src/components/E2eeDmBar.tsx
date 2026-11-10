'use client';

import { useState } from 'react';
import { cn } from '../lib/cn';
import type { E2eeDmController } from '../lib/use-e2ee-dm';
import { Modal } from './Modal';

/** E3 — DM üstü: şifreleme durumu, aç/kapat, güvenlik kodu, yeni cihaz uyarısı */
export function E2eeDmBar({ ctl, peerName }: { ctl: E2eeDmController; peerName: string }) {
  const [confirm, setConfirm] = useState<'on' | 'off' | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  if (!ctl.info) return null;
  return (
    <>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 px-space-md py-1.5 font-label-sm',
          ctl.enabled ? 'bg-primary-container/10 text-on-surface' : 'text-on-surface-variant',
        )}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          {ctl.enabled ? 'lock' : 'lock_open'}
        </span>
        <span className="flex-1">
          {ctl.enabled ? 'Uçtan uca şifreli — mesajları yalnız bu sohbettekilerin cihazları okuyabilir.' : 'Uçtan uca şifreleme kapalı.'}
        </span>
        {ctl.enabled ? (
          <button type="button" onClick={() => setCodeOpen(true)} className="rounded px-2 py-0.5 hover:bg-surface-container-high">
            Güvenlik kodu
          </button>
        ) : null}
        <button
          type="button"
          disabled={ctl.busy}
          onClick={() => setConfirm(ctl.enabled ? 'off' : 'on')}
          className="rounded px-2 py-0.5 font-semibold text-primary hover:bg-surface-container-high disabled:opacity-50"
        >
          {ctl.enabled ? 'Kapat' : 'Şifrelemeyi aç'}
        </button>
      </div>
      {ctl.error ? <p className="px-space-md py-1 font-label-sm text-error">{ctl.error}</p> : null}
      {ctl.enabled && ctl.devicesChanged ? (
        <div className="flex flex-wrap items-center gap-2 bg-error/10 px-space-md py-1.5 font-label-sm text-on-surface">
          <span className="material-symbols-outlined text-[16px] text-error" aria-hidden>
            warning
          </span>
          <span className="flex-1">{peerName} cihazlarını değiştirdi. Güvenlik kodu değişti — önemliyse başka bir yoldan doğrulayın.</span>
          <button type="button" onClick={() => setCodeOpen(true)} className="rounded px-2 py-0.5 hover:bg-surface-container-high">
            Kodu gör
          </button>
          <button type="button" onClick={ctl.acknowledgeDevices} className="rounded px-2 py-0.5 hover:bg-surface-container-high">
            Tamam
          </button>
        </div>
      ) : null}

      <Modal
        open={confirm !== null}
        title={confirm === 'on' ? 'Uçtan uca şifreleme' : 'Şifrelemeyi kapat'}
        onClose={() => setConfirm(null)}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="rounded-lg bg-surface-container-high px-4 py-2 font-label-md text-on-surface">
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                const v = confirm === 'on';
                setConfirm(null);
                void ctl.setEnabled(v);
              }}
              className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary"
            >
              {confirm === 'on' ? 'Aç' : 'Kapat'}
            </button>
          </div>
        }
      >
        {confirm === 'on' ? (
          <ul className="list-disc space-y-1 pl-5 font-body-sm text-on-surface-variant">
            <li>Yeni mesajlar cihazlarınızda şifrelenir; Dracord sunucusu içeriği göremez.</li>
            <li>Bu sohbette şimdilik yalnız metin gönderilebilir (dosya, ses kaydı, GIF ve zamanlama kapalı).</li>
            <li>Şifreli mesajlar aranamaz, düzenlenemez ve şikâyet edilirken içerik sunucuya gönderilmez.</li>
            <li>Sonradan eklediğin yeni bir cihaz, eklenmeden önceki şifreli mesajları okuyamaz.</li>
            <li>Eski uygulama sürümleri bu sohbete mesaj gönderemez; güncellemeleri gerekir.</li>
          </ul>
        ) : (
          <p className="font-body-sm text-on-surface-variant">Bundan sonraki mesajlar şifresiz gönderilir. Önceki şifreli mesajlar şifreli kalır.</p>
        )}
      </Modal>

      <Modal open={codeOpen} title="Güvenlik kodu" onClose={() => setCodeOpen(false)}>
        <p className="mb-3 font-body-sm text-on-surface-variant">
          {peerName} ile bu kodu yüz yüze ya da başka bir yoldan karşılaştırın. Aynıysa aranızda kimse yok demektir. Biri yeni cihaz
          eklediğinde kod değişir.
        </p>
        <p className="rounded-xl bg-surface-container-high p-space-md text-center font-mono text-lg tracking-widest text-on-surface">
          {ctl.safetyNumber}
        </p>
        {ctl.devicesChanged ? (
          <button
            type="button"
            onClick={() => {
              ctl.acknowledgeDevices();
              setCodeOpen(false);
            }}
            className="mt-3 rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary"
          >
            Doğruladım
          </button>
        ) : null}
      </Modal>
    </>
  );
}
