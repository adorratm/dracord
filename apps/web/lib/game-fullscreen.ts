/**
 * Oyun tam ekran + isteğe bağlı yatay kilit.
 */

import { trackGameFullscreen } from '@/lib/analytics';

type OrientationLock = {
  lock?: (orientation: string) => Promise<void> | void;
  unlock?: () => Promise<void> | void;
};

function orientationApi(): OrientationLock | null {
  if (typeof screen === 'undefined' || !screen.orientation) return null;
  return screen.orientation as unknown as OrientationLock;
}

export async function enterGameFullscreen(
  el: HTMLElement,
  opts?: { lockLandscape?: boolean },
): Promise<boolean> {
  try {
    if (document.fullscreenElement && document.fullscreenElement !== el) {
      await document.exitFullscreen();
    }
    if (document.fullscreenElement !== el) {
      await el.requestFullscreen();
    }
    if (opts?.lockLandscape) {
      const ori = orientationApi();
      try {
        await ori?.lock?.('landscape');
      } catch {
        /* iOS / izin yok */
      }
    }
    trackGameFullscreen('activity', Boolean(opts?.lockLandscape));
    return true;
  } catch {
    return false;
  }
}

export async function exitGameFullscreen(): Promise<void> {
  try {
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
  if (document.fullscreenElement === el) {
    await exitGameFullscreen();
    return false;
  }
  return enterGameFullscreen(el, opts);
}

export function isElementFullscreen(el: HTMLElement | null): boolean {
  return Boolean(el && document.fullscreenElement === el);
}
