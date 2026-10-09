/** Watch Party medya URL çözümleyici — doğrudan dosya veya platform embed */

export type WatchMediaProvider =
  | 'file'
  | 'youtube'
  | 'vimeo'
  | 'dailymotion'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x';

export type WatchMediaRef = {
  provider: WatchMediaProvider;
  /** Orijinal kullanıcı URL’si */
  sourceUrl: string;
  /** iframe src (dosyada boş) */
  embedUrl: string;
  /** Platform video / post id */
  id: string | null;
  /** HTML5 <video> ile oynatılabilir mi */
  isDirectFile: boolean;
  /** YouTube / Vimeo / Dailymotion — JS API ile senkron */
  syncable: boolean;
  label: string;
};

const DIRECT_EXT = /\.(mp4|webm|ogg|ogv|m3u8|mov)(\?|#|$)/i;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
    const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{6,})/);
    return m?.[2] ?? null;
  }
  return null;
}

function vimeoId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;
  const m = u.pathname.match(/(?:\/video)?\/(\d{6,})/);
  return m?.[1] ?? null;
}

function dailymotionId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'dailymotion.com' && host !== 'dai.ly') return null;
  if (host === 'dai.ly') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }
  const m = u.pathname.match(/\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/);
  return m?.[1] ?? null;
}

function instagramCode(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'instagram.com' && host !== 'instagr.am') return null;
  const m = u.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

function tiktokId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    // kısa link — id yok; orijinal URL ile embed deneme
    return u.pathname.replace(/^\//, '') || null;
  }
  if (host !== 'tiktok.com' && !host.endsWith('.tiktok.com')) return null;
  const m = u.pathname.match(/\/video\/(\d+)/);
  return m?.[1] ?? null;
}

function facebookHref(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'fb.watch' || host === 'facebook.com' || host === 'm.facebook.com' || host === 'fb.com') {
    return u.toString();
  }
  return null;
}

function xStatusId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'x.com' && host !== 'twitter.com' && host !== 'mobile.twitter.com') return null;
  const m = u.pathname.match(/\/status\/(\d+)/);
  return m?.[1] ?? null;
}

/** Kullanıcı URL’sini Watch Party medya referansına çevir */
export function resolveWatchMedia(raw: string): WatchMediaRef | null {
  const u = safeUrl(raw);
  if (!u) return null;
  const sourceUrl = u.toString();

  const yt = youtubeId(u);
  if (yt) {
    const origin =
      typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    return {
      provider: 'youtube',
      sourceUrl,
      embedUrl: `https://www.youtube.com/embed/${yt}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1${origin ? `&origin=${origin}` : ''}`,
      id: yt,
      isDirectFile: false,
      syncable: true,
      label: 'YouTube',
    };
  }

  const vim = vimeoId(u);
  if (vim) {
    return {
      provider: 'vimeo',
      sourceUrl,
      embedUrl: `https://player.vimeo.com/video/${vim}?api=1&player_id=dracord_vimeo`,
      id: vim,
      isDirectFile: false,
      syncable: true,
      label: 'Vimeo',
    };
  }

  const dm = dailymotionId(u);
  if (dm) {
    return {
      provider: 'dailymotion',
      sourceUrl,
      embedUrl: `https://www.dailymotion.com/embed/video/${dm}?api=postMessage&queue-enable=false`,
      id: dm,
      isDirectFile: false,
      syncable: true,
      label: 'Dailymotion',
    };
  }

  const ig = instagramCode(u);
  if (ig) {
    const [kind, code] = ig.split('/');
    return {
      provider: 'instagram',
      sourceUrl,
      embedUrl: `https://www.instagram.com/${kind}/${code}/embed`,
      id: code ?? null,
      isDirectFile: false,
      syncable: false,
      label: 'Instagram',
    };
  }

  const tt = tiktokId(u);
  if (tt && /^\d+$/.test(tt)) {
    return {
      provider: 'tiktok',
      sourceUrl,
      embedUrl: `https://www.tiktok.com/embed/v2/${tt}`,
      id: tt,
      isDirectFile: false,
      syncable: false,
      label: 'TikTok',
    };
  }
  if (tt && (u.hostname.includes('tiktok.com'))) {
    // kısa link — oEmbed sayfası yerine orijinali iframe’de deneme
    return {
      provider: 'tiktok',
      sourceUrl,
      embedUrl: sourceUrl,
      id: tt,
      isDirectFile: false,
      syncable: false,
      label: 'TikTok',
    };
  }

  const fb = facebookHref(u);
  if (fb && (u.hostname.includes('facebook') || u.hostname.includes('fb.watch') || u.hostname === 'fb.com')) {
    return {
      provider: 'facebook',
      sourceUrl,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(sourceUrl)}&show_text=false&width=1280`,
      id: null,
      isDirectFile: false,
      syncable: false,
      label: 'Facebook',
    };
  }

  const xid = xStatusId(u);
  if (xid) {
    return {
      provider: 'x',
      sourceUrl,
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${xid}`,
      id: xid,
      isDirectFile: false,
      syncable: false,
      label: 'X',
    };
  }

  // Doğrudan medya dosyası
  if (DIRECT_EXT.test(u.pathname) || DIRECT_EXT.test(sourceUrl)) {
    return {
      provider: 'file',
      sourceUrl,
      embedUrl: '',
      id: null,
      isDirectFile: true,
      syncable: true,
      label: 'Dosya',
    };
  }

  // Bilinmeyen https — yine de dosya gibi dene (CDN vb.)
  return {
    provider: 'file',
    sourceUrl,
    embedUrl: '',
    id: null,
    isDirectFile: true,
    syncable: true,
    label: 'Medya',
  };
}

export function watchMediaHint(): string {
  return 'YouTube, Vimeo, Dailymotion, Instagram, TikTok, Facebook, X veya .mp4 bağlantısı';
}
