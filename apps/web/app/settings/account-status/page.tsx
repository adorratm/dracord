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
  const [confirming, setConfirming] = useState(false);

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
      description="Hesabı geçici olarak devre dışı bırak. Oturumlar kapanır; giriş engellenir."
    >
      <SettingsSection title="Devre dışı bırak">
        <div className="px-space-md py-space-md space-y-space-sm">
          <SettingsNote>
            Hesabın silinmez; erişim kesilir. Yeniden etkinleştirme destek ekibi veya
            giriş akışı üzerinden sağlanabilir.
          </SettingsNote>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-space-md py-space-sm rounded-lg bg-error/20 text-error font-label-sm hover:bg-error/30"
            >
              Hesabı devre dışı bırak…
            </button>
          ) : (
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
                  onClick={() => void run()}
                  className="px-space-md py-space-sm rounded-lg bg-error text-on-error font-label-sm disabled:opacity-50"
                >
                  Onayla ve çıkış yap
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
