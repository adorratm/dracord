import { BadRequestException, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** music-bot ile aynı anahtarlar (apps/music-bot/src/runtime-config.ts) */
const CONFIG_KEY = 'music:ytdlp-config';
const STATUS_KEY = 'music:ytdlp-status';

export type MusicConfigView = {
  proxySet: boolean;
  /** kullanıcı/parola gizli: http://us***:****@1.2.3.4:8000 */
  proxyMasked: string | null;
  cookiesSet: boolean;
  cookieRows: number;
  cookieLoginHints: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  lastStatus: { ok: boolean; error?: string; via?: string; at?: string } | null;
};

export function maskProxy(p: string): string {
  try {
    const u = new URL(p);
    const user = u.username ? `${decodeURIComponent(u.username).slice(0, 2)}***` : '';
    const auth = u.username ? `${user}:****@` : '';
    return `${u.protocol}//${auth}${u.host}`;
  } catch {
    return '****';
  }
}

export function validateProxy(raw: string): string {
  const s = raw.trim();
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new BadRequestException('Proxy adresi geçersiz (ör. http://kullanici:parola@1.2.3.4:8000)');
  }
  if (!['http:', 'https:', 'socks5:', 'socks5h:', 'socks4:'].includes(u.protocol)) {
    throw new BadRequestException('Proxy http, https ya da socks5 olmalı');
  }
  if (!u.hostname || !u.port) throw new BadRequestException('Proxy adresinde sunucu ve port olmalı');
  if (s.length > 500) throw new BadRequestException('Proxy adresi çok uzun');
  return s;
}

function cookieInfo(text: string | null): { rows: number; hints: boolean } {
  if (!text) return { rows: 0, hints: false };
  let t = text.trim();
  if (!t.includes('\t')) {
    try {
      const d = Buffer.from(t.replace(/\s+/g, ''), 'base64').toString('utf8');
      if (d.includes('\t')) t = d;
    } catch {
      /* metin */
    }
  }
  const rows = t.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('\t'));
  const blob = rows.join('\n');
  return { rows: rows.length, hints: /\b(LOGIN_INFO|__Secure-1PSID|__Secure-3PSID|SID)\b/.test(blob) };
}

/** Müzik botunun yt-dlp ayarları — yönetim panelinden (sunucu .env'sini ezer) */
@Injectable()
export class MusicConfigService implements OnModuleDestroy {
  private readonly log = new Logger(MusicConfigService.name);
  private readonly redis: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    this.redis = url ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 }) : null;
    void this.redis?.connect().catch((e: Error) => this.log.warn(`redis: ${e.message}`));
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  private async read(): Promise<{ proxy: string | null; cookies: string | null; updatedAt: string | null; updatedBy: string | null }> {
    const raw = await this.redis?.get(CONFIG_KEY);
    const j = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    return { proxy: s(j.proxy), cookies: s(j.cookies), updatedAt: s(j.updatedAt), updatedBy: s(j.updatedBy) };
  }

  async view(): Promise<MusicConfigView> {
    if (!this.redis) throw new BadRequestException('Redis yapılandırılmamış');
    const cfg = await this.read();
    const statusRaw = await this.redis.get(STATUS_KEY);
    const ci = cookieInfo(cfg.cookies);
    return {
      proxySet: !!cfg.proxy,
      proxyMasked: cfg.proxy ? maskProxy(cfg.proxy) : null,
      cookiesSet: !!cfg.cookies,
      cookieRows: ci.rows,
      cookieLoginHints: ci.hints,
      updatedAt: cfg.updatedAt,
      updatedBy: cfg.updatedBy,
      lastStatus: statusRaw ? (JSON.parse(statusRaw) as MusicConfigView['lastStatus']) : null,
    };
  }

  /** undefined = dokunma, null/'' = sil (sunucu .env'sine dön) */
  async update(actorId: string, body: { proxy?: string | null; cookies?: string | null }): Promise<MusicConfigView> {
    if (!this.redis) throw new BadRequestException('Redis yapılandırılmamış');
    const cur = await this.read();
    const next = { ...cur };
    if (body.proxy !== undefined) next.proxy = body.proxy ? validateProxy(String(body.proxy)) : null;
    if (body.cookies !== undefined) {
      const c = body.cookies ? String(body.cookies) : null;
      if (c && c.length > 200_000) throw new BadRequestException('Cookie metni çok büyük');
      if (c && cookieInfo(c).rows === 0) throw new BadRequestException('Cookie metninde Netscape biçiminde satır yok (cookies.txt)');
      next.cookies = c;
    }
    next.updatedAt = new Date().toISOString();
    next.updatedBy = actorId;
    await this.redis.set(CONFIG_KEY, JSON.stringify(next));
    await this.redis.del(STATUS_KEY);
    return this.view();
  }
}
