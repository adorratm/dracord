'use client';

import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

/** GA4 — NEXT_PUBLIC_GA_MEASUREMENT_ID tanımlıysa yüklenir */
export function Analytics() {
  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined') return;
    if (document.getElementById('dracord-ga4')) return;

    const s = document.createElement('script');
    s.id = 'dracord-ga4';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    }
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }, []);

  return null;
}

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}
