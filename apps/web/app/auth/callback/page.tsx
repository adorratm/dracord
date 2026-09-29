'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { persistSession } from '@/lib/storage';
import type { PublicUser } from '@dracord/types';

function AuthCallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { client, setUser } = useAuth();
  const [message, setMessage] = useState('Google girişi tamamlanıyor…');

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
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
        router.replace('/channels/@me');
      })
      .catch(() => {
        const placeholder: PublicUser = {
          id: 'google-user',
          username: 'google',
          displayName: 'Google Kullanıcısı',
          avatarUrl: null,
          status: 'ONLINE',
        };
        persistSession(accessToken, refreshToken, placeholder);
        setUser(placeholder);
        router.replace('/channels/@me');
      });
  }, [params, router, client, setUser]);

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
