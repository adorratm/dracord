/**
 * Spotify web URL → native app URI (spotify:track:…).
 * Örn. https://open.spotify.com/track/abc → spotify:track:abc
 */
export function toSpotifyAppUri(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^spotify:[a-z]+:[a-zA-Z0-9]+/i.test(raw)) return raw;

  try {
    const u = new URL(raw);
    if (!/spotify\.com$/i.test(u.hostname) && !/^open\.spotify\.com$/i.test(u.hostname)) {
      // open.spotify.com veya *.spotify.com
      if (!u.hostname.toLowerCase().includes('spotify.com')) return null;
    }
    const parts = u.pathname.split('/').filter(Boolean);
    // intl-tr/track/xxx veya track/xxx
    let i = 0;
    if (parts[0] && /^intl-[a-z]{2}$/i.test(parts[0])) i = 1;
    const kind = parts[i];
    const id = parts[i + 1];
    if (
      !kind ||
      !id ||
      !/^(track|album|playlist|artist|episode|show|user)$/i.test(kind)
    ) {
      return null;
    }
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '');
    if (!cleanId) return null;
    return `spotify:${kind.toLowerCase()}:${cleanId}`;
  } catch {
    return null;
  }
}

/** Uygulama URI’sinden veya web’den tarayıcıda açılacak HTTPS */
export function toSpotifyWebUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const m = raw.match(/^spotify:([a-z]+):([a-zA-Z0-9]+)/i);
  if (m) return `https://open.spotify.com/${m[1]}/${m[2]}`;
  return raw;
}

export function isSpotifyUrl(input: string): boolean {
  return Boolean(toSpotifyAppUri(input) || /spotify\.com/i.test(input));
}
