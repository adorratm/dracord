'use client';

import { useCallback, useEffect, useState } from 'react';
import { passkeySupported, registerPasskey, type PasskeyClient } from '../lib/passkey';

type Row = { id: string; name: string; synced: boolean; createdAt: string; lastUsedAt: string | null };

export type PasskeysClient = PasskeyClient & {
  listPasskeys(): Promise<Row[]>;
  renamePasskey(id: string, name: string): Promise<unknown>;
  deletePasskey(id: string): Promise<unknown>;
};

/** E1 — Ayarlar › Şifre ve Güvenlik › Passkey'ler */
export function PasskeysPanel({ client }: { client: PasskeysClient }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState('');
  const supported = typeof window !== 'undefined' && passkeySupported();

  const load = useCallback(() => void client.listPasskeys().then(setRows).catch(() => setRows([])), [client]);
  useEffect(load, [load]);

  return (
    <div className="space-y-space-md">
      <p className="font-body-sm text-on-surface-variant">
        Passkey ile şifresiz ve oltalamaya dayanıklı giriş yaparsın: telefonun, bilgisayarın (Windows Hello, Touch ID) ya da güvenlik
        anahtarın kimliğini doğrular. Passkey ile girişte iki adımlı kod istenmez.
      </p>
      {rows === null ? <p className="font-body-sm text-outline">Yükleniyor…</p> : null}
      {rows?.length ? (
        <ul className="divide-y divide-outline-variant/30 rounded-xl bg-surface-container-low">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-space-md py-space-sm">
              <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden>
                passkey
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-md text-on-surface">{r.name}</p>
                <p className="font-label-sm text-on-surface-variant">
                  {r.synced ? 'Eşitlenen passkey' : 'Bu cihaza bağlı'} · eklendi {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                  {r.lastUsedAt ? ` · son kullanım ${new Date(r.lastUsedAt).toLocaleDateString('tr-TR')}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const n = window.prompt('Passkey adı', r.name);
                  if (n && n.trim() && n !== r.name) void client.renamePasskey(r.id, n.trim()).then(load);
                }}
                className="rounded-lg px-2 py-1 font-label-sm text-on-surface-variant hover:bg-surface-container-high"
              >
                Yeniden adlandır
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`"${r.name}" silinsin mi? Bu passkey ile artık giriş yapılamaz.`)) {
                    void client.deletePasskey(r.id).then(load);
                  }
                }}
                className="rounded-lg px-2 py-1 font-label-sm text-error hover:bg-error/10"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      ) : rows ? (
        <p className="font-body-sm text-outline">Henüz passkey yok.</p>
      ) : null}
      {supported ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 64))}
            placeholder="Ad (ör. Telefonum)"
            className="h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setMsg(null);
              void registerPasskey(client, name.trim() || undefined)
                .then(() => {
                  setName('');
                  setMsg({ ok: true, text: 'Passkey eklendi.' });
                  load();
                })
                .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : 'Eklenemedi' }))
                .finally(() => setBusy(false));
            }}
            className="rounded-lg bg-primary-container px-space-md py-space-sm font-label-md text-on-primary-container disabled:opacity-50"
          >
            {busy ? 'Bekleniyor…' : 'Passkey ekle'}
          </button>
        </div>
      ) : (
        <p className="font-body-sm text-on-surface-variant">Passkey eklemek için dracord.com.tr adresini tarayıcıda aç (masaüstü uygulamasında desteklenmiyor).</p>
      )}
      {msg ? <p className={msg.ok ? 'font-body-sm text-on-surface-variant' : 'font-body-sm text-error'}>{msg.text}</p> : null}
    </div>
  );
}
