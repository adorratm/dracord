import { isSpotifyUrl, toSpotifyAppUri, toSpotifyWebUrl } from '@dracord/types';

type OpenResult = { ok?: boolean; error?: string } | void;

type DesktopBridge = {
  openExternal?: (url: string) => Promise<OpenResult> | OpenResult;
};

function desktopBridge(): DesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { dracordDesktop?: DesktopBridge }).dracordDesktop;
}

async function openExternal(url: string): Promise<boolean> {
  const desktop = desktopBridge();
  if (desktop?.openExternal) {
    try {
      const res = await Promise.resolve(desktop.openExternal(url));
      if (res && typeof res === 'object' && res.ok === false) return false;
      return true;
    } catch {
      return false;
    }
  }
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

/**
 * Spotify: önce native `spotify:` protokolü, uygulama yoksa / açılmazsa web.
 * Diğer linkler: doğrudan yeni sekme / shell.
 */
export function openActivityUrl(url: string) {
  const raw = url.trim();
  if (!raw) return;

  if (!isSpotifyUrl(raw)) {
    void openExternal(raw);
    return;
  }

  const appUri = toSpotifyAppUri(raw);
  const webUrl = toSpotifyWebUrl(raw);
  if (!appUri) {
    void openExternal(webUrl);
    return;
  }

  const desktop = desktopBridge();
  if (desktop?.openExternal) {
    void (async () => {
      const ok = await openExternal(appUri);
      if (!ok) await openExternal(webUrl);
    })();
    return;
  }

  // Tarayıcı: app URI dene; sayfa görünür kalırsa web’e düş
  let openedApp = false;
  const onHide = () => {
    openedApp = true;
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('blur', onHide);

  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appUri;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 2000);
  } catch {
    try {
      window.location.href = appUri;
    } catch {
      /* ignore */
    }
  }

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('blur', onHide);
    if (!openedApp && document.visibilityState === 'visible') {
      void openExternal(webUrl);
    }
  }, 1400);
}
