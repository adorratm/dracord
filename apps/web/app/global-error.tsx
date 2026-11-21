'use client';

import { useEffect } from 'react';
import { createErrorReporter } from '@dracord/sdk';

/** Kök düzeyde çöküş: bildir + yeniden dene */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const r = createErrorReporter({
      apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
      platform: 'web',
      getPath: () => window.location.pathname,
      agent: navigator.userAgent,
      disabled: process.env.NODE_ENV !== 'production',
    });
    r.report(error);
    r.flush();
  }, [error]);
  return (
    <html lang="tr">
      <body style={{ background: '#1e1f29', color: '#f8f8f2', fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Bir şeyler ters gitti</h1>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>Hata bize iletildi. Sayfayı yeniden deneyebilirsin.</p>
          <button type="button" onClick={() => reset()} style={{ background: '#bd93f9', color: '#1e1f29', border: 0, borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>
            Yeniden dene
          </button>
        </div>
      </body>
    </html>
  );
}
