import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';

export type ResolvedMusicInput = {
  title: string;
  /** yt-dlp girdisi: URL veya ytsearch1: */
  source: string;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
};

@Injectable()
export class MusicResolveService {
  async resolve(input: string): Promise<ResolvedMusicInput> {
    const q = input.trim();
    if (!q) throw new Error('Boş sorgu');

    if (this.isYoutubeUrl(q)) {
      const id = this.youtubeId(q);
      const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
      const meta = await this.youtubeOembed(q);
      return {
        title: meta?.title || q,
        source: q,
        thumbnailUrl: meta?.thumbnail ?? thumb,
        durationSec: null,
      };
    }

    if (this.isSpotifyUrl(q)) {
      const meta = await this.spotifyOembed(q);
      const search = meta ? `${meta.artist} ${meta.title}`.trim() : q;
      return {
        title: meta ? `${meta.artist} — ${meta.title}` : 'Spotify parçası',
        source: `ytsearch1:${search}`,
        thumbnailUrl: meta?.thumbnail ?? null,
      };
    }

    if (this.isAppleMusicUrl(q)) {
      const meta = await this.appleGuess(q);
      const search = meta || q;
      return {
        title: meta || 'Apple Music parçası',
        source: `ytsearch1:${search}`,
      };
    }

    // Serbest metin araması
    return {
      title: q,
      source: `ytsearch1:${q}`,
    };
  }

  /** Playlist → birden fazla parça (Spotify oembed tek parça; playlist için basit sınır) */
  async resolveMany(input: string, limit = 25): Promise<ResolvedMusicInput[]> {
    const q = input.trim();
    if (this.isSpotifyPlaylist(q)) {
      // Playlist API yok — ilk parçayı oembed ile al; kalan için arama fallback
      const one = await this.resolve(q);
      return [one];
    }
    if (limit < 1) return [];
    return [await this.resolve(q)];
  }

  private isYoutubeUrl(s: string) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(s);
  }

  private youtubeId(url: string): string | null {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.split('/').filter(Boolean)[0];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{6,}$/.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex((p) => p === 'shorts' || p === 'embed' || p === 'live');
      const id = marker >= 0 ? parts[marker + 1] : null;
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  private async youtubeOembed(
    url: string,
  ): Promise<{ title: string; thumbnail: string | null } | null> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        { signal: ctrl.signal },
      );
      clearTimeout(t);
      if (!res.ok) return null;
      const data = (await res.json()) as { title?: string; thumbnail_url?: string };
      return {
        title: data.title || url,
        thumbnail: data.thumbnail_url ?? null,
      };
    } catch {
      return null;
    }
  }

  private isSpotifyUrl(s: string) {
    return /open\.spotify\.com\//i.test(s) || /^spotify:/i.test(s);
  }

  private isSpotifyPlaylist(s: string) {
    return /open\.spotify\.com\/playlist\//i.test(s);
  }

  private isAppleMusicUrl(s: string) {
    return /music\.apple\.com\//i.test(s);
  }

  private async spotifyOembed(
    url: string,
  ): Promise<{ title: string; artist: string; thumbnail: string | null } | null> {
    try {
      const res = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      return {
        title: data.title || 'Bilinmeyen',
        artist: data.author_name || '',
        thumbnail: data.thumbnail_url ?? null,
      };
    } catch {
      return null;
    }
  }

  private async appleGuess(url: string): Promise<string | null> {
    try {
      // URL path'inden kabaca isim çıkar: /album/.../song-name/id
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      const songIdx = parts.findIndex((p) => p === 'song' || p === 'album');
      if (songIdx >= 0 && parts[songIdx + 1]) {
        return decodeURIComponent(parts[songIdx + 1]!.replace(/-/g, ' '));
      }
      return decodeURIComponent(parts.at(-2) || parts.at(-1) || '').replace(/-/g, ' ') || null;
    } catch {
      return null;
    }
  }

  newId() {
    return createId();
  }
}
