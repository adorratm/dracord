'use client';

import { loginWithPasskey, passkeySupported } from '@dracord/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Draco } from '@/components/Draco';
import { useAuth } from '@/components/AuthProvider';

/**
 * E6 — passkey sign-in for the desktop and mobile apps. They cannot run WebAuthn
 * for dracord.com.tr themselves (desktop is file://, mobile would need a native
 * module), so they open this page in the system browser; after the passkey the
 * session goes back to the app through the same dracord://oauth hand-off as Google.
 */
function Inner() {
  const params = useSearchParams();
  const target = params.get('target') === 'mobile' ? 'mobile' : 'desktop';
  const { client } = useAuth();
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSupported(passkeySupported()), []);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await loginWithPasskey(client);
      const q = new URLSearchParams({ accessToken: r.accessToken, refreshToken: r.refreshToken });
      window.location.replace(`/auth/desktop-done?${q.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey ile giriş yapılamadı');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-space-lg bg-surface-container-lowest px-space-lg">
      <Draco size={110} mood="wave" glow />
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-low p-space-lg space-y-space-md text-center">
        <h1 className="font-headline-lg text-on-surface">
          {target === 'mobile' ? 'Uygulamaya passkey ile gir' : 'Masaüstü uygulamasına passkey ile gir'}
        </h1>
        <p className="font-body-md text-on-surface-variant">
          Parmak izin, yüzün ya da cihaz PIN’inle doğrula; ardından Dracord uygulaması açılır ve giriş tamamlanır.
        </p>
        {supported ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void go()}
            className="w-full h-11 rounded-lg bg-primary-container text-on-primary-container font-label-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[20px]">passkey</span>
            {busy ? 'Doğrulanıyor…' : 'Passkey ile devam et'}
          </button>
        ) : (
          <p className="font-body-sm text-error">Bu tarayıcı passkey desteklemiyor.</p>
        )}
        {error ? <p className="font-body-sm text-error">{error}</p> : null}
      </div>
    </div>
  );
}

export default function PasskeyHandoffPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
