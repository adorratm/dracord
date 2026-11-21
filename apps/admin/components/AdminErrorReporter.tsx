'use client';

import { useEffect } from 'react';
import { installBrowserErrorReporter } from '@dracord/sdk';
import { getApiBaseUrl } from '@/lib/client';

export function AdminErrorReporter() {
  useEffect(() => {
    installBrowserErrorReporter({ apiUrl: getApiBaseUrl(), platform: 'admin', disabled: process.env.NODE_ENV !== 'production' });
  }, []);
  return null;
}
