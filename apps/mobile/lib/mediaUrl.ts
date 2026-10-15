import { API_URL } from './config';

/** Web ile aynı varsayılan sunucu banner’ı */
export const DEFAULT_GUILD_BANNER = 'https://dracord.com.tr/guild-banner-default.webp';

/**
 * API’den gelen göreli yolları (`/uploads/...`) ve eksik şemalı URL’leri
 * React Native Image’ın yükleyebileceği mutlak URI’ye çevirir.
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
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${API_URL}${raw}`;
  // `uploads/…` gibi şemasız göreli path
  if (!raw.includes('://')) return `${API_URL}/${raw.replace(/^\.?\//, '')}`;
  return raw;
}

export function guildBannerUrl(bannerUrl?: string | null): string {
  return resolveMediaUrl(bannerUrl) ?? DEFAULT_GUILD_BANNER;
}
