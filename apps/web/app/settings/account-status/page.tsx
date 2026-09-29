'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';

export default function AccountStatusPage() {
  const { client, logout } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'disable' | 'delete'>('idle');

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.deactivateAccount(password || undefined);
      logout();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage
      title="Hesap Durumu"
      description="Hesabı devre dışı bırak. Oturumlar kapanır; giriş engellenir."
    >
      <SettingsSection title="Devre dışı bırak">
        <div className="px-space-md py-space-md space-y-space-sm">
          {mode !== 'disable' ? (
            <button
              type="button"
              onClick={() => setMode('disable')}
              className="px-space-md py-space-sm rounded-lg bg-error/20 text-error font-label-sm hover:bg-error/30"
            >
              Hesabı devre dışı bırak…
            </button>
          ) : (
            <ConfirmBlock
              password={password}
              setPassword={setPassword}
              error={error}
              busy={busy}
              onConfirm={() => void run()}
              onCancel={() => setMode('idle')}
              confirmLabel="Onayla ve çıkış yap"
            />
          )}
        </div>
      </SettingsSection>
      <SettingsSection title="Hesabı sil">
        <div className="px-space-md py-space-md space-y-space-sm">
          <SettingsNote>
            Kalıcı silme yerine hesap devre dışı bırakılır (aynı güvenlik kapısı). Veriler
            sunucuda kalır; erişim kesilir.
          </SettingsNote>
          {mode !== 'delete' ? (
            <button
              type="button"
              onClick={() => setMode('delete')}
              className="px-space-md py-space-sm rounded-lg bg-error text-on-error font-label-sm"
            >
              Hesabı sil…
            </button>
          ) : (
            <ConfirmBlock
              password={password}
              setPassword={setPassword}
              error={error}
              busy={busy}
              onConfirm={() => void run()}
              onCancel={() => setMode('idle')}
              confirmLabel="Silmeyi onayla"
            />
          )}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}

function ConfirmBlock({
  password,
  setPassword,
  error,
  busy,
  onConfirm,
  onCancel,
  confirmLabel,
}: {
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
}) {
  return (
    <div className="space-y-space-sm">
      <label className="block space-y-1">
        <span className="font-label-sm text-on-surface-variant">Şifreni onayla (varsa)</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
        />
      </label>
      {error && <p className="font-body-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="px-space-md py-space-sm rounded-lg bg-error text-on-error font-label-sm disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
