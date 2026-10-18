/** Embed / istemci için açılabilir http(s) URL üret */

export function isHttpUrl(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  return /^https?:\/\//i.test(s.trim());
}

/** ytsearch1:query veya ham arama → YouTube sonuçları */
export function youtubeSearchUrl(query: string): string {
  const q = query.replace(/^ytsearch\d*:/i, '').trim() || 'music';
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/** Genius benzeri söz araması */
export function lyricsSearchUrl(title: string): string {
  const q = `${title} lyrics`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/**
 * Parçayı tarayıcıda açmak için güvenli URL.
 * source/url http değilse (ör. "cengiz kurtoğlu" veya ytsearch1:…) YouTube aramasına düşer.
 */
export function musicOpenUrl(track: {
  title?: string | null;
  url?: string | null;
  source?: string | null;
}): string {
  if (isHttpUrl(track.source)) return track.source!.trim();
  if (isHttpUrl(track.url)) return track.url!.trim();
  const fromSource = track.source?.replace(/^ytsearch\d*:/i, '').trim();
  if (fromSource) return youtubeSearchUrl(fromSource);
  if (track.title?.trim()) return youtubeSearchUrl(track.title);
  return 'https://www.youtube.com';
}

/** `/oynat` için kullanılabilir kaynak (URL veya arama metni) */
export function musicReplayQuery(track: {
  title?: string | null;
  url?: string | null;
  source?: string | null;
}): string {
  if (isHttpUrl(track.source)) return track.source!.trim();
  if (isHttpUrl(track.url)) return track.url!.trim();
  const fromSource = track.source?.replace(/^ytsearch\d*:/i, '').trim();
  if (fromSource) return fromSource;
  return track.title?.trim() || track.url?.trim() || '';
}
