import { BadRequestException, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { EntityManager, LessThan } from 'typeorm';
import { ClientError } from '@/database/entities/client-error.entity';

const PLATFORMS = new Set(['web', 'desktop', 'mobile', 'admin']);
const PER_IP_PER_MIN = 30;
const MAX_ROWS = 2000;
const KEEP_DAYS = 30;

export type ClientErrorInput = {
  platform?: unknown;
  message?: unknown;
  stack?: unknown;
  version?: unknown;
  path?: unknown;
  agent?: unknown;
};

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

/** Kişisel veriyi yığından/mesajdan ayıkla: e-posta, token benzeri uzun diziler, sorgu dizeleri */
export function scrub(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/g, '<jwt>')
    .replace(/([?&](?:token|code|key|secret|access_token|refreshToken|accessToken)=)[^&\s]+/gi, '$1<redacted>')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<long>');
}

/** Gruplama anahtarı: platform + mesajın sayısız hâli + ilk anlamlı yığın satırı (satır/sütun ve hash'siz) */
export function fingerprintOf(platform: string, message: string, stack: string): string {
  const msg = message.replace(/\d+/g, '#').slice(0, 200);
  const frame =
    stack
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^at |@/.test(l)) ?? '';
  const f = frame.replace(/:\d+(:\d+)?\)?$/, '').replace(/[-.][0-9a-f]{6,}(?=\.js)/gi, '').replace(/\?.*$/, '');
  return createHash('sha1').update(`${platform}|${msg}|${f}`).digest('hex');
}

/** Ücretsiz, kendi sunucumuzda hata görünürlüğü (Sentry yerine) */
@Injectable()
export class ClientErrorsService implements OnModuleDestroy {
  private readonly log = new Logger(ClientErrorsService.name);
  private readonly redis: Redis | null;

  constructor(
    private readonly em: EntityManager,
    config: ConfigService,
  ) {
    const url = config.get<string>('REDIS_URL');
    this.redis = url ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
    void this.redis?.connect().catch(() => undefined);
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  private async allowed(ip: string): Promise<boolean> {
    if (!this.redis) return true;
    const key = `client-errors:rl:${ip}:${Math.floor(Date.now() / 60_000)}`;
    try {
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, 70);
      return n <= PER_IP_PER_MIN;
    } catch {
      return true;
    }
  }

  async report(ip: string, body: ClientErrorInput | ClientErrorInput[]): Promise<{ ok: true }> {
    const list = (Array.isArray(body) ? body : [body]).slice(0, 10);
    for (const b of list) {
      if (!(await this.allowed(ip))) break;
      const platform = String(b?.platform ?? '');
      if (!PLATFORMS.has(platform)) throw new BadRequestException('platform');
      const message = scrub(clip(b.message, 1000)).trim();
      if (!message) continue;
      const stack = scrub(clip(b.stack, 6000));
      const fp = fingerprintOf(platform, message, stack);
      const version = clip(b.version, 40) || null;
      const path = scrub(clip(b.path, 300).replace(/\?.*$/, '')) || null;
      const agent = clip(b.agent, 300) || null;
      await this.em.query(
        `INSERT INTO client_errors (id, fingerprint, platform, message, stack, count, "lastVersion", "lastPath", "lastAgent", resolved, "firstSeen", "lastSeen")
         VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, false, now(), now())
         ON CONFLICT (fingerprint) DO UPDATE SET
           count = client_errors.count + 1,
           stack = EXCLUDED.stack,
           "lastVersion" = EXCLUDED."lastVersion",
           "lastPath" = EXCLUDED."lastPath",
           "lastAgent" = EXCLUDED."lastAgent",
           -- çözüldü denmişse ama yeni sürümde tekrar geldiyse yeniden aç
           resolved = CASE WHEN client_errors.resolved AND client_errors."lastVersion" IS DISTINCT FROM EXCLUDED."lastVersion" THEN false ELSE client_errors.resolved END,
           "lastSeen" = now()`,
        [`ce${fp.slice(0, 22)}`, fp, platform, message, stack, version, path, agent],
      );
    }
    return { ok: true };
  }

  async list(opts: { platform?: string; resolved?: boolean; limit?: number }) {
    const qb = this.em.createQueryBuilder(ClientError, 'e').orderBy('e.lastSeen', 'DESC').take(Math.min(opts.limit ?? 200, 500));
    if (opts.platform && PLATFORMS.has(opts.platform)) qb.andWhere('e.platform = :p', { p: opts.platform });
    if (opts.resolved !== undefined) qb.andWhere('e.resolved = :r', { r: opts.resolved });
    const rows = await qb.getMany();
    const since = new Date(Date.now() - 86_400_000);
    const [{ n }] = (await this.em.query(`SELECT coalesce(sum(count),0)::int AS n FROM client_errors WHERE "lastSeen" >= $1`, [since])) as Array<{ n: number }>;
    return { items: rows, last24hEvents: n };
  }

  async setResolved(id: string, resolved: boolean) {
    await this.em.update(ClientError, { id }, { resolved });
    return { ok: true };
  }

  async remove(id: string) {
    await this.em.delete(ClientError, { id });
    return { ok: true };
  }

  /** Eski ve fazla satırları temizle (deploy başına / günlük çağrılır) */
  async prune() {
    await this.em.delete(ClientError, { lastSeen: LessThan(new Date(Date.now() - KEEP_DAYS * 86_400_000)) });
    await this.em.query(
      `DELETE FROM client_errors WHERE id IN (SELECT id FROM client_errors ORDER BY "lastSeen" DESC OFFSET $1)`,
      [MAX_ROWS],
    );
  }
}
