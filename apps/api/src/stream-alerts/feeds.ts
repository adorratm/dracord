/** D7 — saf yardımcılar: girdi ayrıştırma + YouTube RSS okuma (ağ yok, test edilebilir) */

export type ParsedHandle =
  | { platform: 'twitch'; handle: string }
  | { platform: 'youtube'; channelId: string }
  | { platform: 'youtube'; at: string };

const TWITCH_LOGIN = /^[a-zA-Z0-9_]{3,25}$/;
const YT_CHANNEL = /^UC[a-zA-Z0-9_-]{22}$/;
const YT_AT = /^@?[a-zA-Z0-9._-]{3,30}$/;

/** "twitch.tv/xyz", "xyz", "youtube.com/@abc", "youtube.com/channel/UC…" → normalize */
export function parseHandle(platform: string, raw: string): ParsedHandle | null {
  const s = raw.trim();
  if (!s || s.length > 200) return null;
  if (platform === 'twitch') {
    const m = s.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
    const login = (m ? m[1]! : s.replace(/^@/, '')).toLowerCase();
    return TWITCH_LOGIN.test(login) ? { platform: 'twitch', handle: login } : null;
  }
  if (platform === 'youtube') {
    const ch = s.match(/(UC[a-zA-Z0-9_-]{22})/);
    if (ch && YT_CHANNEL.test(ch[1]!)) return { platform: 'youtube', channelId: ch[1]! };
    const at = s.match(/youtube\.com\/(@[a-zA-Z0-9._-]+)/i)?.[1] ?? s;
    if (YT_AT.test(at)) return { platform: 'youtube', at: at.startsWith('@') ? at : `@${at}` };
  }
  return null;
}

export interface FeedItem {
  id: string;
  title: string;
  url: string;
  published: number;
}

const decode = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** YouTube kanal RSS'i → en yeni önce video listesi */
export function parseYoutubeFeed(xml: string): { channelTitle: string | null; items: FeedItem[] } {
  const channelTitle = xml.match(/<feed[\s\S]*?<title>([\s\S]*?)<\/title>/)?.[1];
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1]!;
    const id = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!id || !/^[a-zA-Z0-9_-]{6,20}$/.test(id)) continue;
    const title = decode(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim();
    const published = Date.parse(e.match(/<published>([^<]+)<\/published>/)?.[1] ?? '');
    items.push({ id, title, url: `https://www.youtube.com/watch?v=${id}`, published: Number.isFinite(published) ? published : 0 });
  }
  items.sort((a, b) => b.published - a.published);
  return { channelTitle: channelTitle ? decode(channelTitle).trim() : null, items };
}

/** "@handle" sayfasından kanal kimliğini bul (HTML içinde) */
export function channelIdFromHtml(html: string): string | null {
  const m =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/) ??
    html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/) ??
    html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
  return m?.[1] ?? null;
}

/** bildirim metni: kullanıcı şablonu ya da varsayılan; Markdown kırıcı karakterler kırpılır */
export function renderAlert(
  template: string | null,
  v: { name: string; title: string; url: string; platform: 'twitch' | 'youtube'; live: boolean },
): string {
  const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, 200);
  const def =
    v.platform === 'twitch'
      ? '🔴 **{name}** Twitch\'te canlı: {title}\n{url}'
      : v.live
        ? '🔴 **{name}** YouTube\'da canlı: {title}\n{url}'
        : '▶️ **{name}** yeni video yükledi: {title}\n{url}';
  const t = template?.trim() ? template : def;
  const out = t.replace(/\{name\}/g, clean(v.name)).replace(/\{title\}/g, clean(v.title) || '—').replace(/\{url\}/g, v.url);
  return out.includes(v.url) ? out : `${out}\n${v.url}`;
}
