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

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const runDeactivate = async () => {
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

  const runDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await client.deleteAccount({
        password: deletePassword || undefined,
        confirm: deletePhrase,
      });
      logout();
      router.replace('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Silme başarısız');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <SettingsPage
      title="Hesap Durumu"
      description="Hesabı geçici kapat veya kalıcı sil. Silme geri alınamaz."
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
                <span className="font-label-sm text-on-surface-variant">
                  Şifreni onayla (varsa)
                </span>
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
                  onClick={() => void runDeactivate()}
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

      <SettingsSection title="Hesabı kalıcı sil">
        <div className="px-space-md py-space-md space-y-space-sm">
          <SettingsNote>
            Tüm verilerin silinir ve geri alınamaz. Sahip olduğun sunucuları önce
            sil veya sahipliği devret. Onay için aşağıya <strong>SİL</strong> yaz.
          </SettingsNote>
          {!deleteConfirming ? (
            <button
              type="button"
              onClick={() => setDeleteConfirming(true)}
              className="px-space-md py-space-sm rounded-lg bg-error/20 text-error font-label-sm hover:bg-error/30"
            >
              Hesabımı kalıcı sil…
            </button>
          ) : (
            <div className="space-y-space-sm">
              <label className="block space-y-1">
                <span className="font-label-sm text-on-surface-variant">
                  Onay (SİL yaz)
                </span>
                <input
                  type="text"
                  value={deletePhrase}
                  onChange={(e) => setDeletePhrase(e.target.value)}
                  placeholder="SİL"
                  className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-label-sm text-on-surface-variant">
                  Şifreni onayla (şifreli hesaplarda zorunlu)
                </span>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
                />
              </label>
              {deleteError && <p className="font-body-sm text-error">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void runDelete()}
                  className="px-space-md py-space-sm rounded-lg bg-error text-on-error font-label-sm disabled:opacity-50"
                >
                  Kalıcı sil ve çık
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirming(false)}
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
