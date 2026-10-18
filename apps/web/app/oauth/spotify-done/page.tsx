'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Spotify OAuth dönüşü — popup / Electron penceresini kapatır,
 * mobilde deep link ile uygulamaya döner,
 * tam pencerede bağlantılar sayfasına yönlendirir.
 */
export default function SpotifyOAuthDonePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'ok' | 'error' | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('status') === 'error' ? 'error' : 'ok';
    setStatus(s);

    try {
      // Desktop UI farklı origin'de olabilir (localhost / app://) — '*' gerekli
      window.opener?.postMessage(
        { type: 'dracord-spotify-oauth', status: s },
        '*',
      );
    } catch {
      /* ignore */
    }

    // Mobil uygulama: deep link ile ayarlara dön
    const deepLink = `dracord://spotify-done?status=${s}`;
    const isMobileUa =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

    if (isMobileUa) {
      try {
        window.location.href = deepLink;
      } catch {
        /* ignore */
      }
      const t = window.setTimeout(() => {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }, 400);
      return () => window.clearTimeout(t);
    }

    // Popup ise kapat; Electron main.js de bu URL’de pencereyi kapatır
    const canClose = Boolean(window.opener) || window.history.length <= 1;
    if (canClose) {
      const t = window.setTimeout(() => {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }, 200);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => {
      router.replace(`/settings/connections?spotify=${s}`);
    }, 600);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-surface text-on-surface p-6">
      <p className="font-headline-md">
        {status === 'error' ? 'Spotify bağlantısı başarısız' : 'Spotify bağlandı'}
      </p>
      <p className="font-body-sm text-on-surface-variant">
        Bu pencere otomatik kapanmalı. Kapanmazsa kapatıp ayarlara dönebilirsin.
      </p>
      <button
        type="button"
        className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
        onClick={() => {
          try {
            window.location.href = `dracord://spotify-done?status=${status === 'error' ? 'error' : 'ok'}`;
          } catch {
            /* ignore */
          }
          try {
            window.close();
          } catch {
            /* ignore */
          }
          router.replace(
            `/settings/connections?spotify=${status === 'error' ? 'error' : 'ok'}`,
          );
        }}
      >
        Kapat / Ayarlara dön
      </button>
    </main>
  );
}
