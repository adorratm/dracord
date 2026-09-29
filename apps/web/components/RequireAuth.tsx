'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { hasSession } from '@/lib/storage';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user && !hasSession()) {
      router.replace('/');
    }
  }, [ready, user, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <p className="text-on-surface-variant">Oturum kontrol ediliyor…</p>
      </div>
    );
  }

  if (!user && !hasSession()) {
    return null;
  }

  return children;
}
