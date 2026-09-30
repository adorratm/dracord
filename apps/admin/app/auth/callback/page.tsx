'use client';

import type { PublicUser } from '@dracord/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { clearSession, persistSession } from '@/lib/storage';
import { getDracordClient } from '@/lib/client';

function AuthCallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const [message, setMessage] = useState('Google girişi doğrulanıyor…');

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (!accessToken || !refreshToken) {
      setMessage('Eksik oturum bilgisi. Giriş sayfasına yönlendiriliyorsunuz.');
      const t = setTimeout(() => router.replace('/login'), 1500);
      return () => clearTimeout(t);
    }

    const client = getDracordClient();
    client.setToken(accessToken);

    void client
      .getAdminMe()
      .then((me: PublicUser) => {
        persistSession(accessToken, refreshToken, me);
        setUser(me);
        router.replace('/dashboard');
      })
      .catch((err: unknown) => {
        clearSession();
        client.setToken(null);
        setUser(null);
        const reason =
          err instanceof Error ? err.message.slice(0, 160) : 'admin_denied';
        router.replace(`/login?error=admin_denied&reason=${encodeURIComponent(reason)}`);
      });
  }, [params, router, setUser]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-dracula-bg-dark">
      <p className="text-dracula-comment">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-dracula-bg-dark">
          <p className="text-dracula-comment">Yükleniyor…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
