'use client';

import { useCallback, useEffect, useState } from 'react';
import { describeUserAgent, type SessionDeviceDto } from '@dracord/types';
import { cn } from '../lib/cn';

export type SessionsClient = {
  listSessions(): Promise<SessionDeviceDto[]>;
  revokeSession(id: string): Promise<unknown>;
  revokeOtherSessions(): Promise<{ revoked: number }>;
};

const ICON = { web: 'language', desktop: 'computer', mobile: 'smartphone' } as const;

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 120) return 'şimdi aktif';
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

/** E2 — açık oturumlar / cihazlar: tek tek ya da topluca kapat */
export function SessionsPanel({ client }: { client: SessionsClient }) {
  const [rows, setRows] = useState<SessionDeviceDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    void client
      .listSessions()
      .then(setRows)
      .catch(() => setRows([]));
  }, [client]);
  useEffect(load, [load]);

  if (!rows) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const others = rows.filter((r) => !r.current);

  return (
    <div className="space-y-space-md">
      <ul className="divide-y divide-outline-variant/30 rounded-xl bg-surface-container-low">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-space-md py-space-sm">
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden>
              {ICON[(r.platform ?? 'web') as keyof typeof ICON] ?? 'devices'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-label-md text-on-surface">
                {describeUserAgent(r.userAgent, r.platform)}
                {r.current ? <span className="ml-2 rounded bg-primary-container/20 px-1.5 py-0.5 font-label-sm text-on-surface">bu cihaz</span> : null}
              </p>
              <p className="font-label-sm text-on-surface-variant">
                {ago(r.lastUsedAt)}
                {r.ip ? ` · ${r.ip}` : ''} · ilk giriş {new Date(r.createdAt).toLocaleDateString('tr-TR')}
              </p>
            </div>
            {!r.current ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setBusy(r.id);
                  void client
                    .revokeSession(r.id)
                    .then(load)
                    .finally(() => setBusy(null));
                }}
                className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-error disabled:opacity-50"
              >
                {busy === r.id ? '…' : 'Çıkış yaptır'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!others.length || busy !== null}
          onClick={() => {
            setBusy('all');
            setMsg(null);
            void client
              .revokeOtherSessions()
              .then((r) => {
                setMsg(`${r.revoked} cihazdan çıkış yapıldı.`);
                load();
              })
              .finally(() => setBusy(null));
          }}
          className={cn('rounded-lg px-4 py-2 font-label-md disabled:opacity-50', others.length ? 'bg-error text-on-error' : 'bg-surface-container-high text-on-surface')}
        >
          Diğer tüm cihazlardan çıkış yap
        </button>
        {msg ? <span className="font-body-sm text-on-surface-variant">{msg}</span> : null}
      </div>
      <p className="font-body-sm text-on-surface-variant">
        Tanımadığın bir cihaz görürsen çıkış yaptır ve şifreni / iki adımlı doğrulamanı gözden geçir. Eski sürümlerden açılmış bazı oturumlar
        listede görünmeyebilir; en geç 7 gün içinde kendiliğinden kapanır.
      </p>
    </div>
  );
}
