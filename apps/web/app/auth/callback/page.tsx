'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { persistSession } from '@/lib/storage';
import type { PublicUser } from '@dracord/types';

function parseElectronPayload(raw: string | null): URLSearchParams {
  if (!raw) return new URLSearchParams();
  try {
    const decoded = decodeURIComponent(raw);
    // "oauth?accessToken=...&refreshToken=..." veya düz query string
    const q = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded;
    return new URLSearchParams(q);
  } catch {
    return new URLSearchParams();
  }
}

function AuthCallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { client, setUser } = useAuth();
  const [message, setMessage] = useState('Google girişi tamamlanıyor…');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const electronPayload = params.get('electron')
      ? parseElectronPayload(params.get('payload'))
      : null;
    const pick = (key: string) =>
      electronPayload?.get(key) ?? params.get(key);

    const oauthError = pick('error');
    if (oauthError) {
      setMessage('Google girişi başarısız. Giriş sayfasına yönlendiriliyorsunuz.');
      const t = setTimeout(() => router.replace(`/login?error=${oauthError}`), 1500);
      return () => clearTimeout(t);
    }

    const challenge = pick('challengeToken');
    if (challenge) {
      setChallengeToken(challenge);
      setMessage('İki faktörlü doğrulama gerekli');
      return;
    }

    const accessToken = pick('accessToken');
    const refreshToken = pick('refreshToken');
    if (!accessToken || !refreshToken) {
      setMessage('Eksik oturum bilgisi. Giriş sayfasına yönlendiriliyorsunuz.');
      const t = setTimeout(() => router.replace('/login'), 1500);
      return () => clearTimeout(t);
    }

    client.setToken(accessToken);
    client.connectSocket();

    void client
      .getMe()
      .then((me: PublicUser) => {
        persistSession(accessToken, refreshToken, me);
        setUser(me);
        if (me.usernameConfirmed === false) {
          router.replace('/onboarding/username');
        } else {
          router.replace('/channels/@me');
        }
      })
      .catch(() => {
        const placeholder: PublicUser = {
          id: 'google-user',
          username: 'google',
          displayName: 'Google Kullanıcısı',
          avatarUrl: null,
          status: 'ONLINE',
          usernameConfirmed: false,
        };
        persistSession(accessToken, refreshToken, placeholder);
        setUser(placeholder);
        router.replace('/onboarding/username');
      });
  }, [params, router, client, setUser]);

  const submit2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await client.verifyTwoFactor(challengeToken, code.trim());
      persistSession(result.accessToken, result.refreshToken, result.user);
      client.setToken(result.accessToken);
      client.connectSocket();
      setUser(result.user);
      if (result.user.usernameConfirmed === false) {
        router.replace('/onboarding/username');
      } else {
        router.replace('/channels/@me');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = code.replace(/[\s-]/g, '').length >= 6;

  if (challengeToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-4">
        <form
          onSubmit={(e) => void submit2fa(e)}
          className="w-full max-w-sm rounded-2xl bg-surface-container-low p-space-lg space-y-space-md"
        >
          <h1 className="font-title-md text-on-surface">İki faktörlü doğrulama</h1>
          <p className="font-body-sm text-on-surface-variant">
            Authenticator’daki 6 haneli kodu veya tek kullanımlık kurtarma kodunu
            (XXXX-XXXX) gir.
          </p>
          <input
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full h-12 rounded-lg bg-surface-container-highest px-3 text-center tracking-[0.2em] font-title-md outline-none"
            placeholder="000000 veya XXXX-XXXX"
            autoFocus
          />
          {error && <p className="font-body-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="w-full h-11 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
          >
            Doğrula
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
      <p className="text-on-surface-variant">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
          <p className="text-on-surface-variant">Yükleniyor…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
