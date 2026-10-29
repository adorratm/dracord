'use client';

import { LoginScreen } from '@dracord/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Draco } from '@/components/Draco';
import { useAuth } from '@/components/AuthProvider';
import { appleClientId, signInWithApple } from '@/lib/apple-auth';
import { getDracordClient } from '@/lib/client';
import { hasSession, persistSession } from '@/lib/storage';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, user, client, setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const returnUrl = params.get('returnUrl') || '/channels/@me';
  const showApple = Boolean(appleClientId());

  useEffect(() => {
    if (ready && (user || hasSession())) {
      router.replace(returnUrl.startsWith('/') ? returnUrl : '/channels/@me');
    }
  }, [ready, user, router, returnUrl]);

  const onGoogleLogin = () => {
    setError(null);
    const isDesktop = Boolean(
      (window as Window & { dracordDesktop?: { isElectron?: boolean } }).dracordDesktop
        ?.isElectron,
    );
    window.location.href = getDracordClient().getGoogleLoginUrl(
      isDesktop ? 'desktop' : 'web',
    );
  };

  const onAppleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const apple = await signInWithApple();
      const result = await client.loginWithApple(apple);
      if (result.requires2fa) {
        setError('2FA gerekli — Google ile giriş sonrası ayarlardan doğrula');
        return;
      }
      client.setToken(result.accessToken);
      client.connectSocket();
      persistSession(result.accessToken, result.refreshToken, result.user);
      setUser(result.user);
      router.replace(returnUrl.startsWith('/') ? returnUrl : '/channels/@me');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apple girişi başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginScreen
      showApple={showApple}
      loading={loading}
      errorMessage={error ?? undefined}
      onGoogleLogin={onGoogleLogin}
      onAppleLogin={() => void onAppleLogin()}
      hero={<Draco size={140} mood="wave" glow headset />}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <Draco size={96} mood="float" glow />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
