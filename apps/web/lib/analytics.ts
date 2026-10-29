/**
 * GA4 yardımcıları — Analytics.tsx yüklüyse window.gtag / dataLayer kullanır.
 */

type GtagFn = (...args: unknown[]) => void;

function gtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { gtag?: GtagFn; dataLayer?: unknown[] };
  if (typeof w.gtag === 'function') return w.gtag.bind(w);
  if (Array.isArray(w.dataLayer)) {
    return (...args: unknown[]) => {
      w.dataLayer!.push(args);
    };
  }
  return null;
}

/** Özel olay (oyun join, fullscreen, discover vb.) */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const fn = gtag();
  if (!fn) return;
  try {
    fn('event', name, params ?? {});
  } catch {
    /* ignore */
  }
}

export function trackGameJoin(kind: string, guildId: string) {
  trackEvent('game_join', { game_kind: kind, guild_id: guildId });
}

export function trackGameFullscreen(kind: string, lockedLandscape: boolean) {
  trackEvent('game_fullscreen', {
    game_kind: kind,
    landscape_lock: lockedLandscape,
  });
}

export function trackDiscoverJoin(guildId: string) {
  trackEvent('discover_join', { guild_id: guildId });
}

export function trackInviteAccept(guildId: string, code?: string) {
  trackEvent('invite_accept', { guild_id: guildId, invite_code: code ?? '' });
}

export function trackOnboardingComplete() {
  trackEvent('onboarding_complete');
}

export function trackTemplateCreate(templateId: string) {
  trackEvent('template_create', { template_id: templateId });
}
