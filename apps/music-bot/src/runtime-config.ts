import Redis from 'ioredis';

/**
 * Yönetim panelinden girilen yt-dlp ayarları (proxy + YouTube cookie). .env'deki değerleri ezer;
 * aylık değişen proxy için sunucuya girmeden güncellenir. Redis'te tutulur, 30 sn önbellek.
 */
export const MUSIC_CONFIG_KEY = 'music:ytdlp-config';
export const MUSIC_STATUS_KEY = 'music:ytdlp-status';

export type RuntimeConfig = { proxy: string | null; cookies: string | null; updatedAt: string | null };

let redis: Redis | null = null;
let cache: { at: number; cfg: RuntimeConfig } | null = null;
const TTL_MS = 30_000;

function client(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    void redis.connect().catch(() => undefined);
  } catch {
    redis = null;
  }
  return redis;
}

export async function loadRuntimeConfig(force = false): Promise<RuntimeConfig> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.cfg;
  let cfg: RuntimeConfig = { proxy: null, cookies: null, updatedAt: null };
  try {
    const raw = await client()?.get(MUSIC_CONFIG_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<RuntimeConfig>;
      cfg = {
        proxy: typeof j.proxy === 'string' && j.proxy.trim() ? j.proxy.trim() : null,
        cookies: typeof j.cookies === 'string' && j.cookies.trim() ? j.cookies : null,
        updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : null,
      };
    }
  } catch {
    /* Redis yoksa .env geçerli */
  }
  cache = { at: Date.now(), cfg };
  return cfg;
}

/** Son deneme sonucunu panele bildir (sır yazılmaz) */
export async function reportStatus(status: { ok: boolean; error?: string; via: string }): Promise<void> {
  try {
    await client()?.set(MUSIC_STATUS_KEY, JSON.stringify({ ...status, at: new Date().toISOString() }), 'EX', 7 * 86_400);
  } catch {
    /* ignore */
  }
}
