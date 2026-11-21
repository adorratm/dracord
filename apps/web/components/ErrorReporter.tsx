'use client';

import { useEffect } from 'react';
import { installBrowserErrorReporter } from '@dracord/sdk';

/** Yakalanmamış istemci hatalarını kendi API'mize bildirir (Yönetim › İstemci hataları) */
export function ErrorReporter() {
  useEffect(() => {
    installBrowserErrorReporter({
      apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
      platform: 'web',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? undefined,
      disabled: process.env.NODE_ENV !== 'production',
    });
  }, []);
  return null;
}
