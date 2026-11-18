'use client';

import { useState } from 'react';
import type { PublicUser } from '@dracord/types';
import { SettingsNote, SettingsSection } from './SettingsControls';

interface AccountDataClient {
  exportMyData(): Promise<{ filename: string; text: string }>;
  cancelAccountDeletion(): Promise<{ ok: true }>;
}

function saveTextFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** E5 — "Verilerimi indir" (KVKK m.11 / GDPR m.15) */
export function DataExportSection({ client }: { client: AccountDataClient }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { filename, text } = await client.exportMyData();
      saveTextFile(filename, text);
      setMsg({ ok: true, text: `${filename} indirildi (${Math.max(1, Math.round(text.length / 1024))} KB).` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Döküm alınamadı' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingsSection title="Verilerim">
      <div className="px-space-md py-space-md space-y-space-sm">
        <SettingsNote>
          Profilin, ayarların, giriş yöntemlerin, oturumların, arkadaşlıkların, sunucuların, yazdığın tüm
          mesajlar ve tepkilerin tek bir JSON dosyası olarak iner (KVKK m.11). 10 dakikada bir alınabilir.
        </SettingsNote>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
        >
          {busy ? 'Hazırlanıyor…' : 'Verilerimi indir'}
        </button>
        {msg ? (
          <p role="status" className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>
            {msg.text}
          </p>
        ) : null}
      </div>
    </SettingsSection>
  );
}

/** "18 Kasım 2026" */
export function formatDeletionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

/** E5 — app-wide bar while an account deletion is pending, with a one-click cancel */
export function AccountDeletionBanner({
  user,
  client,
  onCancelled,
}: {
  user: PublicUser | null;
  client: AccountDataClient;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user?.deletionScheduledAt) return null;
  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.cancelAccountDeletion();
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İptal edilemedi');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="alert" className="fixed top-10 left-1/2 -translate-x-1/2 z-[95] w-[min(100%-1.5rem,36rem)] rounded-xl bg-surface-container-high border border-error/50 shadow-float px-space-md py-2 flex flex-wrap items-center justify-center gap-x-space-md gap-y-1 text-center">
      <span className="font-body-sm text-on-surface">
        Hesabın <strong>{formatDeletionDate(user.deletionScheduledAt)}</strong> tarihinde kalıcı olarak silinecek.
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void cancel()}
        className="px-3 py-1 rounded-lg bg-error text-on-error font-label-sm disabled:opacity-50"
      >
        {busy ? 'İptal ediliyor…' : 'Silmeyi iptal et'}
      </button>
      {error ? <span className="font-body-sm text-error">{error}</span> : null}
    </div>
  );
}
