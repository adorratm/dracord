'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';

export default function PasswordSecurityPage() {
  const { client, user, refreshUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [twoFaEnabled, setTwoFaEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [recoveryRemaining, setRecoveryRemaining] = useState(0);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null);
  const [twoFaErr, setTwoFaErr] = useState<string | null>(null);
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await client.getTwoFactorStatus();
      setTwoFaEnabled(s.enabled);
      setRecoveryRemaining(s.recoveryRemaining ?? 0);
    } catch {
      /* ignore */
    }
  }, [client]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, user?.twoFactorEnabled]);

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

  const start2fa = useCallback(async () => {
    setTwoFaBusy(true);
    setTwoFaErr(null);
    setTwoFaMsg(null);
    setSecretCopied(false);
    setRecoveryCodes(null);
    try {
      const res = await client.beginTwoFactorSetup();
      setSetupSecret(res.secret);
      setSetupUrl(res.otpauthUrl);
      setSetupCode('');
    } catch (err) {
      setTwoFaErr(err instanceof Error ? err.message : 'Kurulum başlatılamadı');
    } finally {
      setTwoFaBusy(false);
    }
  }, [client]);

  const confirm2fa = useCallback(async () => {
    setTwoFaBusy(true);
    setTwoFaErr(null);
    try {
      const res = await client.confirmTwoFactorSetup(setupCode.trim());
      setTwoFaEnabled(true);
      setSetupSecret(null);
      setSetupUrl(null);
      setSetupCode('');
      if (res.recoveryCodes?.length) {
        setRecoveryCodes(res.recoveryCodes);
        setRecoveryRemaining(res.recoveryCodes.length);
        setTwoFaMsg(
          '2FA etkinleştirildi. Kurtarma kodlarını güvenli bir yere kaydet — bir daha gösterilmez.',
        );
      } else {
        setTwoFaMsg('2FA etkinleştirildi. Bundan sonra girişte kod istenecek.');
      }
      await refreshUser?.();
      await refreshStatus();
    } catch (err) {
      setTwoFaErr(err instanceof Error ? err.message : 'Kod doğrulanamadı');
    } finally {
      setTwoFaBusy(false);
    }
  }, [client, setupCode, refreshUser, refreshStatus]);

  const cancelSetup = useCallback(async () => {
    await client.cancelTwoFactorSetup().catch(() => undefined);
    setSetupSecret(null);
    setSetupUrl(null);
    setSetupCode('');
    setSecretCopied(false);
  }, [client]);

  const disable2fa = useCallback(async () => {
    setTwoFaBusy(true);
    setTwoFaErr(null);
    try {
      await client.disableTwoFactor({ code: disableCode.trim() });
      setTwoFaEnabled(false);
      setDisableCode('');
      setRecoveryCodes(null);
      setRecoveryRemaining(0);
      setTwoFaMsg('2FA kapatıldı.');
      await refreshUser?.();
    } catch (err) {
      setTwoFaErr(err instanceof Error ? err.message : 'Kapatılamadı');
    } finally {
      setTwoFaBusy(false);
    }
  }, [client, disableCode, refreshUser]);

  const regenerateCodes = useCallback(async () => {
    setTwoFaBusy(true);
    setTwoFaErr(null);
    try {
      const res = await client.regenerateTwoFactorRecovery(regenCode.trim());
      setRegenCode('');
      setRecoveryCodes(res.recoveryCodes);
      setRecoveryRemaining(res.recoveryCodes.length);
      setTwoFaMsg('Yeni kurtarma kodları oluşturuldu. Eski kodlar artık geçersiz.');
    } catch (err) {
      setTwoFaErr(err instanceof Error ? err.message : 'Kodlar yenilenemedi');
    } finally {
      setTwoFaBusy(false);
    }
  }, [client, regenCode]);

  const copySecret = useCallback(async () => {
    if (!setupSecret) return;
    try {
      await navigator.clipboard.writeText(setupSecret);
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      setTwoFaErr('Kopyalanamadı — anahtarı elle seçip kopyala.');
    }
  }, [setupSecret]);

  const copyRecoveryCodes = useCallback(async () => {
    if (!recoveryCodes?.length) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCodesCopied(true);
      window.setTimeout(() => setCodesCopied(false), 2000);
    } catch {
      setTwoFaErr('Kopyalanamadı — kodları elle seçip kopyala.');
    }
  }, [recoveryCodes]);

  const qrSrc = setupUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupUrl)}`
    : null;

  return (
    <SettingsPage
      title="Şifre ve Güvenlik"
      description="Hesap şifreni ve iki faktörlü doğrulamayı yönet."
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
        <div className="px-space-md py-space-md space-y-space-sm">
          <SettingsNote>
            {twoFaEnabled
              ? '2FA açık. Authenticator kodu veya tek kullanımlık kurtarma kodu ile giriş yapılabilir.'
              : 'Authenticator (Google Authenticator, Authy, 1Password…) ile hesabını koru.'}
          </SettingsNote>
          {twoFaMsg && <p className="font-body-sm text-secondary">{twoFaMsg}</p>}
          {twoFaErr && <p className="font-body-sm text-error">{twoFaErr}</p>}

          {recoveryCodes && recoveryCodes.length > 0 && (
            <div className="rounded-xl border border-primary-container/40 bg-primary-container/10 p-space-md space-y-space-sm">
              <p className="font-label-sm text-on-surface">
                Kurtarma kodları (her biri bir kez kullanılır)
              </p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-body-sm">
                {recoveryCodes.map((c) => (
                  <li key={c} className="select-all">
                    {c}
                  </li>
                ))}
              </ul>
              <div className="flex gap-space-sm flex-wrap">
                <button
                  type="button"
                  onClick={() => void copyRecoveryCodes()}
                  className="h-8 px-space-sm rounded-lg bg-surface-container-high font-label-sm"
                >
                  {codesCopied ? 'Kopyalandı' : 'Tümünü kopyala'}
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryCodes(null)}
                  className="h-8 px-space-sm rounded-lg font-label-sm text-on-surface-variant hover:bg-surface-container-high"
                >
                  Sakladım, kapat
                </button>
              </div>
            </div>
          )}

          {!twoFaEnabled && !setupSecret && (
            <button
              type="button"
              disabled={twoFaBusy}
              onClick={() => void start2fa()}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            >
              2FA’yı etkinleştir
            </button>
          )}

          {setupSecret && (
            <div className="space-y-space-sm rounded-xl bg-surface-container-highest p-space-md">
              <p className="font-body-sm text-on-surface">
                1) Authenticator’da QR’ı tara veya anahtarı gir. 2) Gelen 6 haneli kodu onayla.
              </p>
              {qrSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrSrc}
                  alt="2FA QR kodu"
                  width={180}
                  height={180}
                  className="rounded-lg bg-white p-2 mx-auto"
                />
              )}
              <div className="flex items-center gap-space-sm flex-wrap">
                <code className="flex-1 min-w-0 break-all font-label-sm text-primary-container select-all">
                  {setupSecret}
                </code>
                <button
                  type="button"
                  onClick={() => void copySecret()}
                  className="h-8 px-space-sm rounded-lg bg-surface-container-high font-label-sm shrink-0"
                >
                  {secretCopied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
              <label className="block space-y-1">
                <span className="font-label-sm text-on-surface-variant">6 haneli kod</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={setupCode}
                  onChange={(e) =>
                    setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="w-full h-10 rounded-lg bg-surface-container-high px-3 outline-none tracking-widest text-center"
                  placeholder="000000"
                />
              </label>
              <div className="flex gap-space-sm">
                <button
                  type="button"
                  disabled={twoFaBusy || setupCode.length !== 6}
                  onClick={() => void confirm2fa()}
                  className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                >
                  Onayla ve aç
                </button>
                <button
                  type="button"
                  onClick={() => void cancelSetup()}
                  className="px-space-md py-space-sm rounded-lg font-label-sm text-on-surface-variant hover:bg-surface-container-high"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {twoFaEnabled && (
            <div className="space-y-space-md">
              <p className="font-body-sm text-on-surface-variant">
                Kalan kurtarma kodu: {recoveryRemaining}
              </p>

              <div className="space-y-space-sm rounded-xl bg-surface-container-highest p-space-md">
                <p className="font-label-sm text-on-surface">Kurtarma kodlarını yenile</p>
                <label className="block space-y-1">
                  <span className="font-label-sm text-on-surface-variant">
                    Authenticator kodu
                  </span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={regenCode}
                    onChange={(e) =>
                      setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="w-full h-10 rounded-lg bg-surface-container-high px-3 outline-none tracking-widest text-center"
                    placeholder="000000"
                  />
                </label>
                <button
                  type="button"
                  disabled={twoFaBusy || regenCode.length !== 6}
                  onClick={() => void regenerateCodes()}
                  className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                >
                  Yeni kodlar üret
                </button>
              </div>

              <div className="space-y-space-sm">
                <label className="block space-y-1">
                  <span className="font-label-sm text-on-surface-variant">
                    Kapatmak için authenticator veya kurtarma kodu
                  </span>
                  <input
                    autoComplete="one-time-code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.trim())}
                    className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none tracking-widest text-center"
                    placeholder="000000 veya XXXX-XXXX"
                  />
                </label>
                <button
                  type="button"
                  disabled={twoFaBusy || disableCode.length < 6}
                  onClick={() => void disable2fa()}
                  className="px-space-md py-space-sm rounded-lg text-error hover:bg-error/10 font-label-sm disabled:opacity-50"
                >
                  2FA’yı kapat
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
