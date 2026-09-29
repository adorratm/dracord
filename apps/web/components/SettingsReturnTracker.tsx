'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  isDmConversationPath,
  rememberDmReturnPath,
  rememberSettingsReturnPath,
} from '@/lib/settings-return';

/** Ayarlar / DM geri dönüşü için son sayfa yolunu hatırlar. */
export function SettingsReturnTracker() {
  const pathname = usePathname();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const prev = prevRef.current;
    if (isDmConversationPath(pathname) && prev && !isDmConversationPath(prev)) {
      rememberDmReturnPath(prev);
    }

    rememberSettingsReturnPath(pathname);
    prevRef.current = pathname;
  }, [pathname]);

  return null;
}
