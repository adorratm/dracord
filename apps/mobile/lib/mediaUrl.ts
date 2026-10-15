import { API_URL, WEB_URL } from './config';

/** Web ile aynı varsayılan sunucu banner’ı */
export const DEFAULT_GUILD_BANNER = 'https://dracord.com.tr/guild-banner-default.webp';

/**
 * API’den gelen göreli yolları (`/uploads/...`) ve eksik şemalı URL’leri
 * React Native Image’ın yükleyebileceği mutlak URI’ye çevirir.
 *
 * Dracord-Bot avatarı web’de `/logo.svg` — RN Image SVG desteklemez → `logo.png`.
 */
export function resolveMediaUrl(
  url: string | null | undefined,
  fallback?: string | null,
): string | null {
  const raw = (url ?? '').trim();
  if (!raw) return fallback?.trim() || null;
  if (raw.startsWith('data:') || raw.startsWith('file:') || raw.startsWith('content:')) {
    return raw;
  }
  // Bot / uygulama logosu (svg → png, her zaman web origin)
  if (/\/logo\.svg(\?|#|$)/i.test(raw) || /(^|\/)logo\.svg(\?|#|$)/i.test(raw)) {
    return `${WEB_URL}/logo.png`;
  }
  if (/^https?:\/\//i.test(raw)) {
    // Diğer .svg’lerde png eşini dene (aynı path)
    if (/\.svg(\?|#|$)/i.test(raw)) {
      return raw.replace(/\.svg(\?|#|$)/i, '.png$1');
    }
    return raw;
  }
  if (raw.startsWith('//')) {
    const abs = `https:${raw}`;
    if (/\/logo\.svg/i.test(abs) || /\.svg(\?|#|$)/i.test(abs)) {
      return resolveMediaUrl(abs, fallback);
    }
    return abs;
  }
  if (raw.startsWith('/')) {
    // Statik web asset’leri (logo, banner) vs API uploads
    if (raw.startsWith('/uploads')) return `${API_URL}${raw}`;
    if (/\.svg(\?|#|$)/i.test(raw)) {
      return `${WEB_URL}${raw.replace(/\.svg(\?|#|$)/i, '.png$1')}`;
    }
    if (
      raw.startsWith('/logo') ||
      raw.startsWith('/guild-banner') ||
      raw.startsWith('/embed')
    ) {
      return `${WEB_URL}${raw}`;
    }
    return `${API_URL}${raw}`;
  }
  // `uploads/…` gibi şemasız göreli path
  if (!raw.includes('://')) return `${API_URL}/${raw.replace(/^\.?\//, '')}`;
  return raw;
}

export function guildBannerUrl(bannerUrl?: string | null): string {
  return resolveMediaUrl(bannerUrl) ?? DEFAULT_GUILD_BANNER;
}
