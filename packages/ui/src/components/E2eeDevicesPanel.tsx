'use client';

import { useCallback, useEffect, useState } from 'react';
import type { E2eeDeviceDto } from '@dracord/types';

export type E2eeDevicesClient = {
  listE2eeDevices(): Promise<E2eeDeviceDto[]>;
  deleteE2eeDevice(id: string): Promise<E2eeDeviceDto[]>;
};

const ICON: Record<string, string> = { web: 'language', desktop: 'computer', mobile: 'smartphone' };

/** E3 — şifreli DM anahtarı kayıtlı cihazlar; kaybolan / tanınmayan cihazı kaldır */
export function E2eeDevicesPanel({
  client,
  manager,
}: {
  client: E2eeDevicesClient;
  /** Bu cihazın anahtar yöneticisi ("bu cihaz" etiketi + kaldırma kapalı) */
  manager?: { identity(): Promise<{ deviceId: string } | null> } | null;
}) {
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  useEffect(() => {
    if (!manager) return;
    void manager
      .identity()
      .then((i) => setCurrentDeviceId(i?.deviceId ?? null))
      .catch(() => undefined);
  }, [manager]);
  const [rows, setRows] = useState<E2eeDeviceDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    void client
      .listE2eeDevices()
      .then(setRows)
      .catch(() => setRows([]));
  }, [client]);
  useEffect(load, [load]);

  if (!rows) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  if (!rows.length)
    return <p className="font-body-sm text-on-surface-variant">Henüz şifreleme anahtarı kayıtlı cihaz yok. Bir DM açtığında bu cihaz otomatik eklenir.</p>;

  return (
    <div className="space-y-space-sm">
      <ul className="divide-y divide-outline-variant/30 rounded-xl bg-surface-container-low">
        {rows.map((d) => {
          const current = d.id === currentDeviceId;
          return (
            <li key={d.id} className="flex items-center gap-3 px-space-md py-space-sm">
              <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden>
                {ICON[d.platform ?? ''] ?? 'key'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-md text-on-surface">
                  {d.name || 'Cihaz'}
                  {current ? <span className="ml-2 rounded bg-primary-container/20 px-1.5 py-0.5 font-label-sm text-on-surface">bu cihaz</span> : null}
                </p>
                <p className="font-label-sm text-on-surface-variant">
                  eklendi {new Date(d.createdAt).toLocaleDateString('tr-TR')}
                  {d.lastSeenAt ? ` · son görülme ${new Date(d.lastSeenAt).toLocaleDateString('tr-TR')}` : ''}
                </p>
              </div>
              {!current ? (
                confirmId === d.id ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setBusy(d.id);
                        void client
                          .deleteE2eeDevice(d.id)
                          .then(setRows)
                          .catch(load)
                          .finally(() => {
                            setBusy(null);
                            setConfirmId(null);
                          });
                      }}
                      className="rounded-lg bg-error px-3 py-1.5 font-label-md text-on-error disabled:opacity-50"
                    >
                      {busy === d.id ? '…' : 'Kaldır'}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-on-surface">
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(d.id)}
                    className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-error"
                  >
                    Kaldır
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="font-body-sm text-on-surface-variant">
        Kaldırılan cihaz yeni şifreli mesajları okuyamaz. O cihazda uygulama tekrar açılırsa yeni anahtarla yeniden eklenir; eski şifreli
        mesajları yalnız anahtarı hâlâ duruyorsa okuyabilir.
      </p>
    </div>
  );
}
