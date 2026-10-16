'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function buildDeepLink(params: URLSearchParams): string {
  const deep = new URL('dracord://oauth');
  for (const key of [
    'accessToken',
    'refreshToken',
    'challengeToken',
    'error',
    'reason',
  ]) {
    const v = params.get(key);
    if (v) deep.searchParams.set(key, v);
  }
  return deep.toString();
}

function isElectronUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Electron/i.test(navigator.userAgent);
}

function DesktopDoneInner() {
  const params = useSearchParams();
  const [launched, setLaunched] = useState(false);
  const [closeHint, setCloseHint] = useState(false);
  const deepLink = useMemo(() => buildDeepLink(params), [params]);
  const hasError = Boolean(params.get('error'));
  const hasSession = Boolean(
    params.get('accessToken') || params.get('challengeToken'),
  );
  const inElectron = isElectronUa();

  useEffect(() => {
    if (!hasSession && !hasError) return;
    const t = window.setTimeout(() => {
      window.location.href = deepLink;
      setLaunched(true);
      // Sistem tarayıcısında window.close çalışmaz — kısayol ipucu
      if (!inElectron) {
        window.setTimeout(() => setCloseHint(true), 400);
      } else {
        // Electron OAuth penceresi: ana süreç did-navigate ile kapatır;
        // yedek olarak close dene
        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }, 500);
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [deepLink, hasSession, hasError, inElectron]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'radial-gradient(ellipse at 50% 0%, #2d1b4e 0%, #11131e 55%)',
        color: '#f8f8f2',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '0.08em' }}>
          <span style={{ color: '#bd93f9' }}>DR</span>
          <span style={{ color: '#50fa7b' }}>ACO</span>
          <span style={{ color: '#bd93f9' }}>RD</span>
        </h1>
        {hasError ? (
          <>
            <p style={{ margin: 0, color: '#ff5555' }}>
              Giriş tamamlanamadı. Masaüstü uygulamasından tekrar dene.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#6272a4' }}>
              {params.get('reason') ?? params.get('error')}
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {launched ? 'Giriş başarılı' : 'Masaüstü uygulamasına dönülüyor…'}
            </p>
            <p style={{ margin: 0, color: '#8be9fd', lineHeight: 1.5 }}>
              {inElectron
                ? 'Bu pencere otomatik kapanacak.'
                : 'Dracord açıldı. Bu sekmeyi elle kapatabilirsin.'}
            </p>
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <a
            href={deepLink}
            style={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: 44,
              borderRadius: 12,
              background: '#bd93f9',
              color: '#11131e',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Dracord’u aç
          </a>
          {!inElectron ? (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: closeHint ? '#f8f8f2' : '#6272a4',
                lineHeight: 1.45,
              }}
            >
              Sekmeyi kapatmak için{' '}
              <kbd
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid #44475a',
                  background: '#1a1c2c',
                  fontWeight: 700,
                }}
              >
                Ctrl+W
              </kbd>{' '}
              (Mac:{' '}
              <kbd
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid #44475a',
                  background: '#1a1c2c',
                  fontWeight: 700,
                }}
              >
                Cmd+W
              </kbd>
              ).
              <br />
              <span style={{ fontSize: 12, color: '#6272a4' }}>
                Tarayıcılar güvenlik nedeniyle «sekmeyi kapat» düğmesine izin vermez.
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function DesktopDonePage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100dvh',
            display: 'grid',
            placeItems: 'center',
            background: '#11131e',
            color: '#f8f8f2',
          }}
        >
          Yükleniyor…
        </main>
      }
    >
      <DesktopDoneInner />
    </Suspense>
  );
}
