'use client';

import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const loadShell = () => import('@/components/VoiceShell');
const VoiceShell = lazy(loadShell);

/** Ses oturumuna ihtiyaç duymayan herkese açık yollar */
const PUBLIC_PREFIXES = ['/login', '/download', '/legal', '/s', '/invite', '/auth', '/oauth'];

export function isPublicPath(pathname: string | null): boolean {
  if (!pathname || pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Herkese açık sayfalarda ses kabuğunu (LiveKit) yükleme; uygulama sayfasına ilk girişte yükle
 * ve sonra hep bağlı tut — açık bir arama, herkese açık bir sayfaya gidilince kopmasın.
 */
export function VoiceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);
  const [mounted, setMounted] = useState(!isPublic);
  // Uygulama yoluna geçildiği ilk çizimde hemen kabuğu kullan (sağlayıcısız bir kare olmasın)
  const active = mounted || !isPublic;

  useEffect(() => {
    if (!isPublic) setMounted(true);
  }, [isPublic]);

  // Herkese açık sayfada: sayfa boşa çıkınca paketi önceden ısıt (LCP'yi etkilemez)
  useEffect(() => {
    if (active) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const warm = () => void loadShell().catch(() => undefined);
    const t = window.setTimeout(() => {
      if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 5000 });
      else warm();
    }, 4000);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active) return <>{children}</>;
  return (
    <Suspense fallback={null}>
      <VoiceShell>{children}</VoiceShell>
    </Suspense>
  );
}
