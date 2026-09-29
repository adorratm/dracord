'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { rememberSettingsReturnPath } from '@/lib/settings-return';

/** Ayarlar dışı sayfa yolunu hatırlar; ayarlar kapanınca buraya dönülür. */
export function SettingsReturnTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) rememberSettingsReturnPath(pathname);
  }, [pathname]);

  return null;
}
