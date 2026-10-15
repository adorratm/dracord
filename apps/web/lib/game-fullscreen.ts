/**
 * Oyun tam ekran + isteğe bağlı yatay kilit.
 * React Native WebView içinde document.fullscreen çoğu cihazda çalışmaz;
 * native tarafa postMessage ile landscape istenir.
 */

import { trackGameFullscreen } from '@/lib/analytics';

type OrientationLock = {
  lock?: (orientation: string) => Promise<void> | void;
  unlock?: () => Promise<void> | void;
};

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __dracordRnFs?: boolean;
  }
}

function orientationApi(): OrientationLock | null {
  if (typeof screen === 'undefined' || !screen.orientation) return null;
  return screen.orientation as unknown as OrientationLock;
}

function isReactNativeWebView(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ReactNativeWebView);
}

function postRnFullscreen(enter: boolean, lockLandscape: boolean) {
  try {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({
        type: 'dracord-game-fs',
        enter,
        landscape: lockLandscape,
      }),
    );
  } catch {
    /* ignore */
  }
}

export async function enterGameFullscreen(
  el: HTMLElement,
  opts?: { lockLandscape?: boolean },
): Promise<boolean> {
  const lockLandscape = Boolean(opts?.lockLandscape);
  try {
    if (isReactNativeWebView()) {
      window.__dracordRnFs = true;
      el.dataset.rnFs = '1';
      postRnFullscreen(true, lockLandscape);
      trackGameFullscreen('activity', lockLandscape);
      window.dispatchEvent(new Event('dracord-rn-fs'));
      return true;
    }

    if (document.fullscreenElement && document.fullscreenElement !== el) {
      await document.exitFullscreen();
    }
    if (document.fullscreenElement !== el) {
      await el.requestFullscreen();
    }
    if (lockLandscape) {
      const ori = orientationApi();
      try {
        await ori?.lock?.('landscape');
      } catch {
        /* iOS / izin yok */
      }
    }
    trackGameFullscreen('activity', lockLandscape);
    return true;
  } catch {
    return false;
  }
}

export async function exitGameFullscreen(): Promise<void> {
  try {
    if (isReactNativeWebView()) {
      window.__dracordRnFs = false;
      document.querySelectorAll('[data-rn-fs]').forEach((n) => {
        delete (n as HTMLElement).dataset.rnFs;
      });
      postRnFullscreen(false, false);
      window.dispatchEvent(new Event('dracord-rn-fs'));
      return;
    }

    const ori = orientationApi();
    try {
      await ori?.unlock?.();
    } catch {
      /* ignore */
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    /* ignore */
  }
}

export async function toggleGameFullscreen(
  el: HTMLElement | null,
  opts?: { lockLandscape?: boolean },
): Promise<boolean> {
  if (!el) return false;
  if (isReactNativeWebView()) {
    if (window.__dracordRnFs) {
      await exitGameFullscreen();
      return false;
    }
    return enterGameFullscreen(el, opts);
  }
  if (document.fullscreenElement === el) {
    await exitGameFullscreen();
    return false;
  }
  return enterGameFullscreen(el, opts);
}

export function isElementFullscreen(el: HTMLElement | null): boolean {
  if (isReactNativeWebView()) {
    return Boolean(window.__dracordRnFs);
  }
  return Boolean(el && document.fullscreenElement === el);
}
