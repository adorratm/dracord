/** Watch Party medya URL çözümleyici — doğrudan dosya veya platform embed */

export type WatchMediaProvider =
  | 'file'
  | 'youtube'
  | 'vimeo'
  | 'dailymotion'
  | 'twitch'
  | 'streamable'
  | 'rumble'
  | 'googledrive'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'iframe';

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
  /** YouTube / Vimeo / Dailymotion / Twitch — JS API ile senkron */
  syncable: boolean;
  label: string;
};

const DIRECT_EXT = /\.(mp4|webm|ogg|ogv|m3u8|mov|mkv)(\?|#|$)/i;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function hostParent(): string {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname || 'localhost';
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

function twitchRef(u: URL): { kind: 'video' | 'clip' | 'channel'; id: string } | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'clips.twitch.tv') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id ? { kind: 'clip', id } : null;
  }
  if (host !== 'twitch.tv' && host !== 'm.twitch.tv') return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts[0] === 'videos' && parts[1]) return { kind: 'video', id: parts[1] };
  if (parts[1] === 'clip' && parts[2]) return { kind: 'clip', id: parts[2] };
  if (parts[0] && !['directory', 'downloads', 'p'].includes(parts[0])) {
    return { kind: 'channel', id: parts[0] };
  }
  return null;
}

function streamableId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'streamable.com') return null;
  const parts = u.pathname.split('/').filter(Boolean);
  const id = parts[0] === 'e' || parts[0] === 'o' ? parts[1] : parts[0];
  return id && /^[a-zA-Z0-9]+$/.test(id) ? id : null;
}

function rumbleId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'rumble.com') return null;
  const embed = u.pathname.match(/^\/embed\/([a-zA-Z0-9]+)/);
  if (embed) return embed[1]!;
  const m = u.pathname.match(/^\/(v[a-zA-Z0-9]+)/);
  return m?.[1] ?? null;
}

function googleDriveId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;
  const m = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1]!;
  const id = u.searchParams.get('id');
  return id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
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
  const parent = encodeURIComponent(hostParent());

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

  const tw = twitchRef(u);
  if (tw) {
    let embedUrl = '';
    if (tw.kind === 'video') {
      embedUrl = `https://player.twitch.tv/?video=${tw.id}&parent=${parent}&autoplay=false`;
    } else if (tw.kind === 'clip') {
      embedUrl = `https://clips.twitch.tv/embed?clip=${tw.id}&parent=${parent}&autoplay=false`;
    } else {
      embedUrl = `https://player.twitch.tv/?channel=${tw.id}&parent=${parent}&autoplay=false`;
    }
    return {
      provider: 'twitch',
      sourceUrl,
      embedUrl,
      id: tw.id,
      isDirectFile: false,
      syncable: false,
      label: 'Twitch',
    };
  }

  const sm = streamableId(u);
  if (sm) {
    return {
      provider: 'streamable',
      sourceUrl,
      embedUrl: `https://streamable.com/e/${sm}`,
      id: sm,
      isDirectFile: false,
      syncable: false,
      label: 'Streamable',
    };
  }

  const rm = rumbleId(u);
  if (rm) {
    return {
      provider: 'rumble',
      sourceUrl,
      embedUrl: `https://rumble.com/embed/${rm}/`,
      id: rm,
      isDirectFile: false,
      syncable: false,
      label: 'Rumble',
    };
  }

  const gd = googleDriveId(u);
  if (gd) {
    return {
      provider: 'googledrive',
      sourceUrl,
      embedUrl: `https://drive.google.com/file/d/${gd}/preview`,
      id: gd,
      isDirectFile: false,
      syncable: false,
      label: 'Google Drive',
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
  if (tt && u.hostname.includes('tiktok.com')) {
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

  // Bilinmeyen https sayfa — iframe ile dene (birçok site X-Frame engelleyebilir)
  return {
    provider: 'iframe',
    sourceUrl,
    embedUrl: sourceUrl,
    id: null,
    isDirectFile: false,
    syncable: false,
    label: 'Bağlantı',
  };
}

export function watchMediaHint(): string {
  return 'YouTube, Twitch, Vimeo, Streamable, Drive, TikTok veya herhangi bir video linki';
}
