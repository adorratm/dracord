'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  totpOtpauthUrl,
  verifyTotpCode,
} from '@/lib/totp';

export default function PasswordSecurityPage() {
  const { client, user } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [totpInput, setTotpInput] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (next.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalı.');
      return;
    }
    if (next !== confirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (!current) {
      setError('Mevcut şifreni gir.');
      return;
    }
    setBusy(true);
    try {
      await client.changePassword(current, next);
      setMessage('Şifren güncellendi.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre güncellenemedi');
    } finally {
      setBusy(false);
    }
  };

  const start2fa = () => {
    setSetupSecret(generateTotpSecret());
    setTotpInput('');
    setTotpError(null);
  };

  const confirm2fa = async () => {
    if (!setupSecret) return;
    const ok = await verifyTotpCode(setupSecret, totpInput);
    if (!ok) {
      setTotpError('Kod geçersiz. Authenticator uygulamanı kontrol et.');
      return;
    }
    setSection('security', {
      twoFactorEnabled: true,
      twoFactorSecret: setupSecret,
      recoveryCodes: generateRecoveryCodes(),
    });
    setSetupSecret(null);
    setTotpInput('');
    setTotpError(null);
  };

  const disable2fa = async () => {
    if (!prefs.security.twoFactorSecret) {
      setSection('security', {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: [],
      });
      return;
    }
    const ok = await verifyTotpCode(prefs.security.twoFactorSecret, totpInput);
    if (!ok) {
      setTotpError('Devre dışı bırakmak için geçerli kod gerekli.');
      return;
    }
    setSection('security', {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      recoveryCodes: [],
    });
    setTotpInput('');
    setTotpError(null);
  };

  return (
    <SettingsPage
      title="Şifre ve Güvenlik"
      description="Şifre değiştir ve iki faktörlü doğrulamayı yönet."
    >
      <SettingsSection title="Şifre değiştir">
        <form onSubmit={(e) => void submit(e)} className="px-space-md py-space-md space-y-space-sm">
          <label className="block space-y-1">
            <span className="font-label-sm text-on-surface-variant">Mevcut şifre</span>
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-label-sm text-on-surface-variant">Yeni şifre</span>
            <input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-label-sm text-on-surface-variant">Yeni şifre (tekrar)</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
            />
          </label>
          {error && <p className="font-body-sm text-error">{error}</p>}
          {message && <p className="font-body-sm text-secondary">{message}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
          >
            Şifreyi güncelle
          </button>
        </form>
      </SettingsSection>

      <SettingsSection title="İki faktörlü doğrulama (2FA)">
        {prefs.security.twoFactorEnabled ? (
          <div className="px-space-md py-space-md space-y-space-sm">
            <p className="font-body-sm text-secondary">2FA etkin.</p>
            {prefs.security.recoveryCodes.length > 0 && (
              <div>
                <p className="font-label-sm text-on-surface-variant mb-1">Kurtarma kodları</p>
                <ul className="font-mono text-body-sm grid grid-cols-2 gap-1">
                  {prefs.security.recoveryCodes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <input
              value={totpInput}
              onChange={(e) => setTotpInput(e.target.value)}
              placeholder="Authenticator kodu"
              className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
            />
            {totpError && <p className="font-body-sm text-error">{totpError}</p>}
            <button
              type="button"
              onClick={() => void disable2fa()}
              className="px-space-md py-space-sm rounded-lg bg-error/20 text-error font-label-sm"
            >
              2FA’yı kapat
            </button>
          </div>
        ) : setupSecret ? (
          <div className="px-space-md py-space-md space-y-space-sm">
            <p className="font-body-sm text-on-surface-variant">
              Authenticator uygulamasına bu anahtarı ekle:
            </p>
            <p className="font-mono text-primary-container break-all">{setupSecret}</p>
            <button
              type="button"
              className="font-label-sm text-primary-container hover:underline"
              onClick={() =>
                void navigator.clipboard.writeText(
                  totpOtpauthUrl(setupSecret, user?.username ?? 'user'),
                )
              }
            >
              otpauth URL’sini kopyala
            </button>
            <input
              value={totpInput}
              onChange={(e) => setTotpInput(e.target.value)}
              placeholder="6 haneli kod"
              className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
            />
            {totpError && <p className="font-body-sm text-error">{totpError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void confirm2fa()}
                className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
              >
                Doğrula ve etkinleştir
              </button>
              <button
                type="button"
                onClick={() => setSetupSecret(null)}
                className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
              >
                İptal
              </button>
            </div>
          </div>
        ) : (
          <div className="px-space-md py-space-md">
            <button
              type="button"
              onClick={start2fa}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              2FA’yı etkinleştir
            </button>
            <SettingsNote>
              Google Authenticator / Authy ile uyumlu TOTP. Kodlar bu cihazda doğrulanır.
            </SettingsNote>
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
