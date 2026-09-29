import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GifDto } from '@dracord/types';

interface KlipyMediaFormat {
  url?: string;
  dims?: number[];
  size?: number;
}

interface KlipyResult {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: Record<string, KlipyMediaFormat>;
}

interface KlipyResponse {
  results?: KlipyResult[];
  error?: { message?: string };
  /** bazı yanıtlarda sarmalanmış olabilir */
  data?: { results?: KlipyResult[] };
}

/**
 * Tenor API kapatıldı (Haz 2026). Klipy, Tenor ile neredeyse aynı v2 sözleşmesini
 * sunuyor: https://api.klipy.com/v2 — ücretsiz test anahtarı partner panelinden.
 */
@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  private apiKey(): string | null {
    const key =
      this.config.get<string>('KLIPY_API_KEY')?.trim() ||
      this.config.get<string>('TENOR_API_KEY')?.trim();
    return key || null;
  }

  private mapResult(item: KlipyResult): GifDto | null {
    const formats = item.media_formats ?? {};
    const full =
      formats.gif?.url ||
      formats.mediumgif?.url ||
      formats.tinygif?.url ||
      formats.nanogif?.url;
    const preview =
      formats.nanogif?.url ||
      formats.tinygif?.url ||
      formats.mediumgif?.url ||
      formats.gif?.url ||
      full;
    if (!full || !preview) return null;
    return {
      id: item.id,
      url: full,
      previewUrl: preview,
      label: item.title || item.content_description || 'GIF',
    };
  }

  private async klipyFetch(path: string, params: Record<string, string>): Promise<GifDto[]> {
    const key = this.apiKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'Klipy API anahtarı yok. .env içine KLIPY_API_KEY ekleyin (https://klipy.com/developers — ücretsiz test anahtarı).',
      );
    }

    const qs = new URLSearchParams({
      key,
      client_key: 'dracord_web',
      contentfilter: 'low',
      media_filter: 'gif,tinygif,nanogif,mediumgif',
      limit: '24',
      ...params,
    });

    const res = await fetch(`https://api.klipy.com/v2/${path}?${qs.toString()}`);
    const data = (await res.json()) as KlipyResponse;
    if (!res.ok) {
      throw new BadRequestException(
        data.error?.message || `Klipy isteği başarısız (${res.status})`,
      );
    }

    const results = data.results ?? data.data?.results ?? [];
    return results.map((r) => this.mapResult(r)).filter((x): x is GifDto => Boolean(x));
  }

  searchGifs(query: string): Promise<GifDto[]> {
    const q = query.trim();
    if (!q) return this.featuredGifs();
    return this.klipyFetch('search', { q, locale: 'tr_TR', country: 'TR' });
  }

  featuredGifs(): Promise<GifDto[]> {
    return this.klipyFetch('featured', { locale: 'tr_TR', country: 'TR' });
  }

  /** @deprecated Tenor uyumluluk */
  searchTenor(query: string) {
    return this.searchGifs(query);
  }

  /** @deprecated Tenor uyumluluk */
  featuredTenor() {
    return this.featuredGifs();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }
}
