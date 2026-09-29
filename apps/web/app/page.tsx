'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { hasSession } from '@/lib/storage';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasSession() ? '/channels/@me' : '/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
      <p className="text-on-surface-variant font-body-md">Yönlendiriliyor…</p>
    </div>
  );
}
