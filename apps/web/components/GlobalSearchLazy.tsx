'use client';

import { lazy, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';

const GlobalSearch = lazy(() => import('@/components/GlobalSearch').then((m) => ({ default: m.GlobalSearch })));

/** Ctrl+K araması yalnız oturum açıkken yüklenir — herkese açık sayfalar arama/arayüz paketini indirmez */
export function GlobalSearchLazy() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <GlobalSearch />
    </Suspense>
  );
}
